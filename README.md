# 🚀 AWS Load Balancer & Auto Scaling Stress Test

A Node.js application designed to test AWS Application Load Balancers (ALB) and Auto Scaling Groups (ASG) by generating on-demand CPU load.

## ✨ Features

- 🔥 **CPU Stress Testing**: Generate 100% CPU load with a single button click
- 📊 **Real-time Metrics**: Live CPU usage monitoring with visual bars
- 🏷️ **Instance Identification**: Display AWS instance ID, availability zone, and hostname
- ⏱️ **Configurable Duration**: Set custom stress test duration (10-600 seconds)
- 🎨 **Beautiful UI**: Modern, responsive interface with gradient design
- 🔍 **Health Checks**: Built-in health endpoint for load balancer integration
- 📡 **API Endpoints**: RESTful API for programmatic testing

## 🎯 Use Cases

1. **Load Balancer Testing**: Verify traffic distribution across multiple instances
2. **Auto Scaling Validation**: Test scale-out and scale-in behavior
3. **Health Check Verification**: Ensure load balancers detect unhealthy instances
4. **Performance Benchmarking**: Measure response times under load
5. **Cost Optimization**: Test minimum viable instance configurations

## 🏗️ Architecture Options

### Option 1: Docker (ECS/Fargate) ⭐ Recommended for Production

**Pros:**
- ✅ Easy to scale and manage
- ✅ Consistent environment across deployments
- ✅ Better for microservices architecture
- ✅ Automatic health checks and service recovery
- ✅ Rolling updates with zero downtime

**Cons:**
- ❌ Higher cost (Fargate premium)
- ❌ Longer startup time (~1-2 minutes)
- ❌ More complex initial setup

**Best For:**
- Production environments
- Long-term deployments
- Teams familiar with containerization
- Multi-service architectures

### Option 2: Bare-Metal EC2 ⭐ Recommended for Testing/Learning

**Pros:**
- ✅ Lower cost (EC2 only)
- ✅ Faster startup time (~30-60 seconds)
- ✅ Simpler setup and debugging
- ✅ Direct access to instance

**Cons:**
- ❌ Manual AMI management
- ❌ Less portable
- ❌ More manual maintenance

**Best For:**
- Quick testing and learning
- Cost-sensitive projects
- Simple architectures
- Development environments

## 🚀 Quick Start

### Local Development

```bash
# Clone or navigate to the project
cd stress-test-app

# Install dependencies
npm install

# Start the server
npm start

# Visit http://localhost:3000
```

### Docker Local Testing

```bash
# Build and run with Docker Compose
docker-compose up

# Or build manually
docker build -t stress-test-app .
docker run -p 3000:3000 stress-test-app
```

## 📦 Project Structure

```
stress-test-app/
├── server.js                 # Main application file
├── package.json             # Node.js dependencies
├── Dockerfile               # Docker container definition
├── docker-compose.yml       # Local Docker setup
├── DEPLOYMENT_GUIDE.md      # Comprehensive deployment guide
├── deploy-ec2.sh           # Quick EC2 deployment script
└── README.md               # This file
```

## 🔌 API Endpoints

### `GET /`
Main application interface with stress test controls

**Response:** HTML page with UI

### `POST /stress`
Start CPU stress test

**Request Body:**
```json
{
  "duration": 60000  // Duration in milliseconds
}
```

**Response:**
```json
{
  "success": true,
  "message": "Stress test started",
  "duration": 60000
}
```

### `POST /stop-stress`
Stop active stress test

**Response:**
```json
{
  "success": true,
  "message": "Stress test stopped"
}
```

### `GET /metrics`
Get current CPU metrics and stress status

**Response:**
```json
{
  "isStressing": true,
  "cpus": [
    { "core": 0, "usage": 98 },
    { "core": 1, "usage": 97 }
  ],
  "loadAvg": ["1.85", "1.42", "0.98"],
  "totalCPUs": 2
}
```

### `GET /health`
Health check endpoint for load balancers

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-02-07T10:30:00.000Z"
}
```

## 🧪 Testing Scenarios

### 1. Basic Load Balancer Test

```bash
# Get your ALB DNS name
ALB_DNS="stress-test-alb-1234567890.ap-southeast-1.elb.amazonaws.com"

# Make multiple requests and observe instance IDs
for i in {1..10}; do
  curl -s http://$ALB_DNS/ | grep "Instance ID"
  sleep 1
done
```

### 2. Auto Scaling Test

```bash
# Start stress on all instances
for i in {1..5}; do
  curl -X POST http://$ALB_DNS/stress \
    -H "Content-Type: application/json" \
    -d '{"duration": 180000}' &
done

# Monitor auto scaling
watch -n 10 'aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names stress-test-asg \
  --query "AutoScalingGroups[0].DesiredCapacity"'
```

### 3. Load Testing with Apache Bench

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Run load test
ab -n 10000 -c 100 http://$ALB_DNS/

# Concurrent stress tests
ab -n 1000 -c 50 -p stress.json -T application/json http://$ALB_DNS/stress
```

`stress.json`:
```json
{"duration": 120000}
```

### 4. Health Check Verification

```bash
# Start stress test
curl -X POST http://$ALB_DNS/stress -d '{"duration": 300000}'

# Monitor health checks
watch -n 5 'aws elbv2 describe-target-health \
  --target-group-arn <YOUR_TG_ARN>'
```

## 📊 Monitoring

### CloudWatch Metrics to Watch

**For EC2:**
- `CPUUtilization`
- `NetworkIn`/`NetworkOut`
- `StatusCheckFailed`

**For ALB:**
- `TargetResponseTime`
- `RequestCount`
- `HealthyHostCount`/`UnHealthyHostCount`
- `HTTPCode_Target_2XX_Count`

**For ECS:**
- `CPUUtilization`
- `MemoryUtilization`
- `RunningTasksCount`

### Real-time Monitoring Commands

```bash
# Watch CPU utilization
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=AutoScalingGroupName,Value=stress-test-asg \
  --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60 \
  --statistics Average

# Watch target health
aws elbv2 describe-target-health \
  --target-group-arn <YOUR_TG_ARN> \
  --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State]' \
  --output table
```

## 🎨 UI Features

### Main Dashboard
- **Instance Information**: ID, AZ, hostname, CPU cores
- **Status Indicator**: Visual status of stress test (active/stopped)
- **CPU Usage Bars**: Real-time CPU usage per core
- **Duration Control**: Slider to set test duration
- **Control Buttons**: Start stress, stop, refresh

### Visual Indicators
- 🟢 Green: System healthy, ready for testing
- 🔴 Red: Stress test active, CPU at 100%
- 📊 Blue bars: Real-time CPU usage visualization

## 🔧 Configuration

### Environment Variables

```bash
# Port (default: 3000)
PORT=3000

# Node environment
NODE_ENV=production
```

### Docker Configuration

```dockerfile
# Adjust resources in docker-compose.yml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 512M
```

### Auto Scaling Configuration

**Scale Out Threshold:** CPU > 70%  
**Scale In Threshold:** CPU < 30%  
**Cooldown Period:** 300 seconds  
**Min Instances:** 2  
**Max Instances:** 10

## 🛡️ Security Considerations

1. **Security Groups**: Restrict access to known IPs
2. **IAM Roles**: Use minimal required permissions
3. **SSL/TLS**: Use HTTPS in production (ACM certificate)
4. **Rate Limiting**: Implement API rate limiting for production
5. **Authentication**: Add authentication for production deployments

## 💰 Cost Estimation (Singapore Region)

### Docker (ECS Fargate)
- 2 tasks (0.5 vCPU, 1GB): ~$21/month
- ALB: ~$16/month
- Data transfer: ~$5/month
- **Total: ~$42/month**

### Bare-Metal (EC2)
- 2x t3.micro: ~$12/month
- ALB: ~$16/month
- Data transfer: ~$5/month
- **Total: ~$33/month**

### During Load Testing
- Auto-scaled instances: ~$0.01/hour per instance
- Data transfer: ~$0.09/GB

## 🧹 Cleanup

### Remove Docker Deployment

```bash
# Stop and remove service
aws ecs update-service --cluster stress-test-cluster \
  --service stress-test-service --desired-count 0
aws ecs delete-service --cluster stress-test-cluster \
  --service stress-test-service
aws ecs delete-cluster --cluster stress-test-cluster

# Delete ALB and target group
aws elbv2 delete-load-balancer --load-balancer-arn <ALB_ARN>
aws elbv2 delete-target-group --target-group-arn <TG_ARN>
```

### Remove EC2 Deployment

```bash
# Delete Auto Scaling Group
aws autoscaling delete-auto-scaling-group \
  --auto-scaling-group-name stress-test-asg --force-delete

# Delete Launch Template
aws ec2 delete-launch-template --launch-template-name stress-test-lt

# Delete Security Group
aws ec2 delete-security-group --group-id <SG_ID>

# Delete ALB components (same as above)
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

## 📝 License

MIT License - feel free to use this for learning and testing purposes.

## 📚 Additional Resources

- [AWS Auto Scaling Documentation](https://docs.aws.amazon.com/autoscaling/)
- [AWS Application Load Balancer Guide](https://docs.aws.amazon.com/elasticloadbalancing/)
- [AWS ECS Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)

## ❓ Troubleshooting

### Application Not Starting
```bash
# Check logs (EC2)
sudo journalctl -u stress-test -f

# Check logs (ECS)
aws logs tail /ecs/stress-test-app --follow
```

### Load Balancer Not Distributing Traffic
- Verify security group allows ALB to reach instances
- Check target group health checks
- Ensure instances are in healthy state

### Auto Scaling Not Triggering
- Verify CloudWatch alarms are configured
- Check scaling policies are attached
- Ensure IAM permissions are correct
- Wait for cooldown period to expire

### Instance Metadata Not Working
- Only works on actual EC2 instances
- Returns 'localhost-dev' when running locally
- Check IMDSv2 configuration

---

**Built with ❤️ for AWS testing and learning**