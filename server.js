const express = require("express");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
const { Worker } = require("worker_threads");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());

// Store active stress workers
let stressWorkers = [];
let isStressing = false;

// ---- EC2 metadata (instance id / az) ----
async function getInstanceId() {
  try {
    const instanceId = execSync(
      "curl -s http://169.254.169.254/latest/meta-data/instance-id",
      { timeout: 2000 }
    )
      .toString()
      .trim();
    return instanceId;
  } catch {
    return "localhost-dev";
  }
}

async function getAvailabilityZone() {
  try {
    const az = execSync(
      "curl -s http://169.254.169.254/latest/meta-data/placement/availability-zone",
      { timeout: 2000 }
    )
      .toString()
      .trim();
    return az;
  } catch {
    return "local";
  }
}

// ---- REAL CPU usage calc ----
// We compute CPU usage by comparing os.cpus() snapshots over time.
let lastCpuSnapshot = os.cpus();

function calcCpuUsagePercent(prev, curr) {
  // returns array of usage percent per core
  return curr.map((c, i) => {
    const p = prev[i];
    const prevTotal =
      p.times.user + p.times.nice + p.times.sys + p.times.idle + p.times.irq;
    const currTotal =
      c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;

    const totalDiff = currTotal - prevTotal;
    const idleDiff = c.times.idle - p.times.idle;

    if (totalDiff <= 0) return 0;
    const usage = (1 - idleDiff / totalDiff) * 100;
    return Math.max(0, Math.min(100, usage));
  });
}

// ---- CPU stress using worker threads (multi-core real) ----
function stressCPU(durationMs = 60000) {
  const numCPUs = os.cpus().length;

  console.log(`Starting CPU stress with ${numCPUs} worker(s) for ${durationMs}ms`);
  isStressing = true;

  // Safety: if somehow called twice
  stopStress();

  for (let i = 0; i < numCPUs; i++) {
    const worker = new Worker(path.join(__dirname, "stress-worker.js"));

    worker.on("message", (msg) => {
      if (msg && msg.done) {
        // worker finished its duration
        worker.terminate().catch(() => {});
      }
    });

    worker.on("exit", () => {
      stressWorkers = stressWorkers.filter((w) => w !== worker);

      if (stressWorkers.length === 0) {
        isStressing = false;
        console.log("CPU stress test completed");
      }
    });

    worker.on("error", (err) => {
      console.error("Worker error:", err);
    });

    stressWorkers.push(worker);
    worker.postMessage({ durationMs });
  }
}

// Stop all stress workers
function stopStress() {
  stressWorkers.forEach((w) => {
    try {
      w.terminate();
    } catch {}
  });
  stressWorkers = [];
  isStressing = false;
  console.log("CPU stress stopped");
}

// ---- UI page ----
app.get("/", async (req, res) => {
  const instanceId = await getInstanceId();
  const az = await getAvailabilityZone();
  const hostname = os.hostname();
  const cpus = os.cpus().length;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Stress Test</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; background: #f5f5f5; padding: 40px 20px; }
    .container { max-width: 520px; margin: 0 auto; }
    h1 { font-size: 22px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #fff; }
    th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 14px; }
    th { color: #888; font-weight: 500; width: 40%; }
    td { font-family: monospace; word-break: break-all; }
    .status { padding: 10px; text-align: center; font-weight: 600; font-size: 14px; margin-bottom: 16px; border-radius: 4px; background: #e8f5e9; color: #2e7d32; }
    .status.stressing { background: #ffebee; color: #c62828; }
    .cpu-bars { margin-bottom: 16px; }
    .cpu-bar { background: #e0e0e0; height: 22px; border-radius: 3px; margin-bottom: 6px; overflow: hidden; }
    .cpu-bar-fill { height: 100%; background: #4caf50; font-size: 12px; color: #fff; line-height: 22px; padding-left: 8px; transition: width 0.3s; }
    .controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .controls input { width: 90px; padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; }
    .controls label { font-size: 13px; color: #666; }
    button { padding: 8px 16px; font-size: 14px; border: none; border-radius: 4px; cursor: pointer; color: #fff; }
    .btn-stress { background: #d32f2f; }
    .btn-stop { background: #f57c00; }
    .btn-refresh { background: #1976d2; }
    button:hover { opacity: 0.85; }
    .hint { margin-top: 10px; font-size: 12px; color: #777; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Load Balancer Stress Test</h1>

    <table>
      <tr><th>Instance ID</th><td>${instanceId}</td></tr>
      <tr><th>Availability Zone</th><td>${az}</td></tr>
      <tr><th>Hostname</th><td>${hostname}</td></tr>
      <tr><th>CPU Cores</th><td>${cpus}</td></tr>
    </table>

    <div class="status" id="status"><span id="status-text">Ready</span></div>
    <div class="cpu-bars" id="cpu-bars"></div>

    <div class="controls">
      <button class="btn-stress" onclick="startStress()">Start</button>
      <button class="btn-stop" onclick="stopStress()">Stop</button>
      <button class="btn-refresh" onclick="location.reload()">Refresh</button>
      <label>Duration (s)</label>
      <input type="number" id="duration" value="120" min="10" max="1800" />
    </div>

    <div class="hint">
      Tip: If your Target Group has <b>stickiness</b> enabled, refresh may keep showing the same instance ID.
      Disable stickiness to see different instance IDs.
    </div>
  </div>

  <script>
    let updateInterval;

    async function startStress() {
      const duration = Number(document.getElementById("duration").value || 60) * 1000;
      try {
        await fetch("/stress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ duration })
        });
        updateStatus(true);
        startMonitoring();
      } catch (e) { console.error(e); }
    }

    async function stopStress() {
      try {
        await fetch("/stop-stress", { method: "POST" });
        updateStatus(false);
        stopMonitoring();
      } catch (e) { console.error(e); }
    }

    function updateStatus(active) {
      const el = document.getElementById("status");
      const txt = document.getElementById("status-text");
      el.className = active ? "status stressing" : "status";
      txt.textContent = active ? "CPU Stress Active" : "Idle";
    }

    async function updateMetrics() {
      try {
        const res = await fetch("/metrics");
        const data = await res.json();

        document.getElementById("cpu-bars").innerHTML =
          data.cpus.map((cpu, i) =>
            '<div class="cpu-bar"><div class="cpu-bar-fill" style="width:' +
            cpu.usage + '%">Core ' + i + ': ' + cpu.usage + '%</div></div>'
          ).join("");

        updateStatus(data.isStressing);
      } catch (e) { console.error(e); }
    }

    function startMonitoring() { stopMonitoring(); updateInterval = setInterval(updateMetrics, 1000); }
    function stopMonitoring() { if (updateInterval) clearInterval(updateInterval); }

    updateMetrics();
    startMonitoring();
  </script>
</body>
</html>
`;
  res.send(html);
});

// ---- API endpoints ----
app.post("/stress", (req, res) => {
  const duration = Number(req.body?.duration || 60000);

  if (isStressing) {
    return res.json({ success: false, message: "Stress test already running" });
  }

  stressCPU(duration);
  res.json({ success: true, message: "Stress test started", duration });
});

app.post("/stop-stress", (req, res) => {
  stopStress();
  res.json({ success: true, message: "Stress test stopped" });
});

app.get("/metrics", (req, res) => {
  const curr = os.cpus();
  const usageArr = calcCpuUsagePercent(lastCpuSnapshot, curr);
  lastCpuSnapshot = curr;

  res.json({
    isStressing,
    cpus: usageArr.map((u, i) => ({ core: i, usage: Math.round(u) })),
    loadAvg: os.loadavg().map((l) => l.toFixed(2)),
    totalCPUs: curr.length,
  });
});

// Health check endpoint for load balancer
app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Stress test server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to start testing`);
});
