/**
 * Smart EV Buggy - ROS 2 WebSocket Bridge Handler
 * Connects to rosbridge_server (port 9090) using dynamic host binding
 */

const ROSBridge = {
  ros: null,
  connected: false,
  reconnectInterval: 3000,
  listeners: {
    connection: [],
    map: [],
    scan: [],
    odom: [],
    imu: [],
    gps: [],
    pointcloud: []
  },

  init() {
    // Dynamic host binding: works seamlessly on localhost and Wi-Fi IP
    const hostname = window.location.hostname || 'localhost';
    const wsUrl = `ws://${hostname}:9090`;

    console.log(`[ROSBridge] Connecting to ${wsUrl}...`);
    this.updateStatus('CONNECTING', 'warning');

    if (typeof ROSLIB === 'undefined') {
      console.error('[ROSBridge] ROSLIB is not loaded!');
      this.updateStatus('ROSLIB ERROR', 'danger');
      return;
    }

    this.ros = new ROSLIB.Ros({
      url: wsUrl
    });

    this.ros.on('connection', () => {
      console.log('[ROSBridge] Connected successfully!');
      this.connected = true;
      this.updateStatus('CONNECTED', 'success');
      this.setupSubscriptions();
      this.notifyListeners('connection', true);
    });

    this.ros.on('error', (error) => {
      console.warn('[ROSBridge] Connection error:', error);
      this.connected = false;
      this.updateStatus('DISCONNECTED', 'danger');
      this.notifyListeners('connection', false);
    });

    this.ros.on('close', () => {
      console.log('[ROSBridge] Connection closed. Retrying in 3s...');
      this.connected = false;
      this.updateStatus('DISCONNECTED', 'danger');
      this.notifyListeners('connection', false);
      setTimeout(() => this.init(), this.reconnectInterval);
    });
  },

  updateStatus(text, level) {
    const badge = document.getElementById('bridge-status-badge');
    const textEl = document.getElementById('bridge-status-text');
    if (badge) {
      badge.className = `status-pill pill-${level}`;
    }
    if (textEl) {
      textEl.textContent = text;
    }
  },

  setupSubscriptions() {
    // 1. Occupancy Grid (/map)
    const mapTopic = new ROSLIB.Topic({
      ros: this.ros,
      name: '/map',
      messageType: 'nav_msgs/OccupancyGrid',
      throttle_rate: 1000
    });
    mapTopic.subscribe((message) => {
      this.notifyListeners('map', message);
    });

    // 2. Filtered LiDAR Scan (/scan_filtered)
    const scanTopic = new ROSLIB.Topic({
      ros: this.ros,
      name: '/scan_filtered',
      messageType: 'sensor_msgs/LaserScan',
      throttle_rate: 100
    });
    scanTopic.subscribe((message) => {
      this.notifyListeners('scan', message);
    });

    // 3. EKF Filtered Odometry (/odometry/filtered)
    const odomTopic = new ROSLIB.Topic({
      ros: this.ros,
      name: '/odometry/filtered',
      messageType: 'nav_msgs/Odometry',
      throttle_rate: 50
    });
    odomTopic.subscribe((message) => {
      this.updateTelemetryOdom(message);
      this.notifyListeners('odom', message);
    });

    // 4. WitMotion IMU (/imu/data)
    const imuTopic = new ROSLIB.Topic({
      ros: this.ros,
      name: '/imu/data',
      messageType: 'sensor_msgs/Imu',
      throttle_rate: 100
    });
    imuTopic.subscribe((message) => {
      this.updateTelemetryImu(message);
      this.notifyListeners('imu', message);
    });

    // 5. Holybro M9N GNSS (/fix)
    const gpsTopic = new ROSLIB.Topic({
      ros: this.ros,
      name: '/fix',
      messageType: 'sensor_msgs/NavSatFix',
      throttle_rate: 500
    });
    gpsTopic.subscribe((message) => {
      this.updateTelemetryGps(message);
      this.notifyListeners('gps', message);
    });

    // 6. ZED 2i Stereo 3D Point Cloud (/zed/zed_node/point_cloud/cloud_registered)
    const pcTopic = new ROSLIB.Topic({
      ros: this.ros,
      name: '/zed/zed_node/point_cloud/cloud_registered',
      messageType: 'sensor_msgs/PointCloud2',
      throttle_rate: 1000
    });
    pcTopic.subscribe((message) => {
      this.notifyListeners('pointcloud', message);
    });
  },

  updateTelemetryOdom(msg) {
    const vx = msg.twist.twist.linear.x;
    const vy = msg.twist.twist.linear.y;
    const speed = Math.sqrt(vx * vx + vy * vy);
    const speedEl = document.getElementById('stat-speed');
    if (speedEl) {
      speedEl.textContent = `${speed.toFixed(2)} m/s (${(speed * 3.6).toFixed(1)} km/h)`;
    }
  },

  updateTelemetryImu(msg) {
    const q = msg.orientation;
    // Quaternion to Euler (Roll, Pitch, Yaw)
    const sinr_cosp = 2 * (q.w * q.x + q.y * q.z);
    const cosr_cosp = 1 - 2 * (q.x * q.x + q.y * q.y);
    const roll = Math.atan2(sinr_cosp, cosr_cosp) * (180 / Math.PI);

    const sinp = 2 * (q.w * q.y - q.z * q.x);
    let pitch;
    if (Math.abs(sinp) >= 1) {
      pitch = Math.sign(sinp) * (Math.PI / 2) * (180 / Math.PI);
    } else {
      pitch = Math.asin(sinp) * (180 / Math.PI);
    }

    const siny_cosp = 2 * (q.w * q.z + q.x * q.y);
    const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z);
    let yaw = Math.atan2(siny_cosp, cosy_cosp) * (180 / Math.PI);
    if (yaw < 0) yaw += 360;

    const headingEl = document.getElementById('stat-heading');
    if (headingEl) {
      headingEl.textContent = `${yaw.toFixed(1)}° (${this.getCompassDir(yaw)})`;
    }

    const rpyEl = document.getElementById('stat-rpy');
    if (rpyEl) {
      rpyEl.textContent = `R: ${roll.toFixed(1)}° | P: ${pitch.toFixed(1)}°`;
    }
  },

  updateTelemetryGps(msg) {
    const statusEl = document.getElementById('stat-gps-status');
    const coordsEl = document.getElementById('stat-gps-coords');

    const status = msg.status ? msg.status.status : -1;
    const lat = typeof msg.latitude === 'number' ? msg.latitude : parseFloat(msg.latitude);
    const lon = typeof msg.longitude === 'number' ? msg.longitude : parseFloat(msg.longitude);
    const isCoordsValid = isFinite(lat) && isFinite(lon) && !isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0);

    let statusText = 'NO FIX';
    let statusClass = 'pill-danger';
    if (status >= 0 && isCoordsValid) {
      statusText = status === 0 ? '3D FIX' : 'RTK/DGPS';
      statusClass = 'pill-success';
    }

    if (statusEl) {
      statusEl.textContent = statusText;
      statusEl.className = `status-pill ${statusClass}`;
    }

    if (coordsEl) {
      if (isCoordsValid) {
        coordsEl.textContent = `${lat.toFixed(6)}°, ${lon.toFixed(6)}°`;
      } else {
        coordsEl.textContent = 'Searching satellites...';
      }
    }
  },

  getCompassDir(deg) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(deg / 45) % 8];
  },

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  },

  notifyListeners(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Error in listener for ${event}:`, e);
        }
      });
    }
  }
};

window.ROSBridge = ROSBridge;
