const { parentPort } = require("worker_threads");

parentPort.on("message", ({ durationMs }) => {
  const end = Date.now() + Number(durationMs || 60000);

  while (Date.now() < end) {
    Math.sqrt(Math.random());
  }

  parentPort.postMessage({ done: true });
});
