/**
 * Smart EV Buggy - 2D SLAM & 3D WebGL Mapping Visualizer
 * Renders live /map occupancy grid, /scan_filtered, and 3D point cloud/spatial grid
 */

const MapRenderer = {
  // 2D Canvas State
  canvas2D: null,
  ctx2D: null,
  mapData: null,
  mapOffscreenCanvas: null,
  lastScan: null,
  robotPose: { x: 0, y: 0, yaw: 0 },
  poseTrail: [],
  scale: 25.0, // pixels per meter
  panX: 0,
  panY: 0,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
  followRobot: true,

  // 3D Three.js State
  canvas3D: null,
  scene3D: null,
  camera3D: null,
  renderer3D: null,
  robotMesh3D: null,
  lidarPoints3D: null,
  mapMesh3D: null,
  is3DInitialized: false,
  orbit3D: {
    isMouseDown: false,
    prevMouseX: 0,
    prevMouseY: 0,
    theta: 0.8,
    phi: 0.6,
    radius: 12.0,
    target: { x: 0, y: 0, z: 0 }
  },

  init() {
    this.init2D();
    this.init3D();
    this.bindEvents();
    this.bindROS();
  },

  init2D() {
    this.canvas2D = document.getElementById('map-canvas-2d');
    if (!this.canvas2D) return;
    this.ctx2D = this.canvas2D.getContext('2d');
    this.mapOffscreenCanvas = document.createElement('canvas');
    this.resize2D();
    window.addEventListener('resize', () => this.resize2D());
  },

  resize2D() {
    if (!this.canvas2D || !this.canvas2D.parentElement) return;
    const rect = this.canvas2D.parentElement.getBoundingClientRect();
    this.canvas2D.width = rect.width;
    this.canvas2D.height = rect.height;
    if (this.panX === 0 && this.panY === 0) {
      this.panX = this.canvas2D.width / 2;
      this.panY = this.canvas2D.height / 2;
    }
    this.render2D();
  },

  init3D() {
    this.canvas3D = document.getElementById('map-canvas-3d');
    if (!this.canvas3D || typeof THREE === 'undefined') {
      console.warn('[MapRenderer] Three.js not available, 3D viewport disabled');
      return;
    }

    const rect = this.canvas3D.parentElement.getBoundingClientRect();
    const width = rect.width || 400;
    const height = rect.height || 300;

    // 1. Scene & Camera
    this.scene3D = new THREE.Scene();
    this.scene3D.background = new THREE.Color(0x0f172a); // Slate-900

    this.camera3D = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.update3DCamera();

    // 2. Renderer
    this.renderer3D = new THREE.WebGLRenderer({
      canvas: this.canvas3D,
      antialias: true,
      alpha: true
    });
    this.renderer3D.setSize(width, height);
    this.renderer3D.setPixelRatio(window.devicePixelRatio || 1);

    // 3. Lighting & Ground Grid
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene3D.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x00f5d4, 0.5);
    dirLight.position.set(10, 20, 10);
    this.scene3D.add(dirLight);

    const gridHelper = new THREE.GridHelper(30, 30, 0x38bdf8, 0x1e293b);
    gridHelper.rotation.x = Math.PI / 2; // Lie on XY plane in ROS coordinates
    this.scene3D.add(gridHelper);

    // 4. Vehicle 3D Representation
    const carGroup = new THREE.Group();

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.8, 0.5, 0.3);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0x0284c7, wireframe: false });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.set(0, 0, 0.15);
    carGroup.add(bodyMesh);

    // Heading cone/indicator
    const coneGeo = new THREE.ConeGeometry(0.15, 0.35, 8);
    coneGeo.rotateX(Math.PI / 2);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    coneMesh.position.set(0.5, 0, 0.15);
    carGroup.add(coneMesh);

    // Coordinate Axes Tripod (RGB: X=Red forward, Y=Green left, Z=Blue up)
    const axesHelper = new THREE.AxesHelper(0.6);
    carGroup.add(axesHelper);

    this.robotMesh3D = carGroup;
    this.scene3D.add(this.robotMesh3D);

    // 5. 3D LiDAR Point Cloud (BufferGeometry)
    const maxPoints = 2000;
    const pointPositions = new Float32Array(maxPoints * 3);
    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));

    const pointMaterial = new THREE.PointsMaterial({
      color: 0x00f5d4,
      size: 0.08,
      transparent: true,
      opacity: 0.85
    });

    this.lidarPoints3D = new THREE.Points(pointGeometry, pointMaterial);
    this.scene3D.add(this.lidarPoints3D);

    this.is3DInitialized = true;
    this.animate3D();
  },

  update3DCamera() {
    if (!this.camera3D) return;
    const { theta, phi, radius, target } = this.orbit3D;
    this.camera3D.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
    this.camera3D.position.y = target.y + radius * Math.cos(phi);
    this.camera3D.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
    this.camera3D.lookAt(target.x, target.y, target.z);
  },

  animate3D() {
    if (!this.is3DInitialized) return;
    requestAnimationFrame(() => this.animate3D());
    if (this.renderer3D && this.scene3D && this.camera3D) {
      this.renderer3D.render(this.scene3D, this.camera3D);
    }
  },

  bindEvents() {
    // 2D Pan and Zoom controls
    if (this.canvas2D) {
      this.canvas2D.addEventListener('mousedown', (e) => {
        this.isDragging = true;
        this.dragStartX = e.clientX - this.panX;
        this.dragStartY = e.clientY - this.panY;
      });

      window.addEventListener('mousemove', (e) => {
        if (this.isDragging) {
          this.panX = e.clientX - this.dragStartX;
          this.panY = e.clientY - this.dragStartY;
          this.followRobot = false;
          this.updateFollowUI();
          this.render2D();
        }
      });

      window.addEventListener('mouseup', () => {
        this.isDragging = false;
      });

      this.canvas2D.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
        this.scale = Math.max(5.0, Math.min(150.0, this.scale * zoomFactor));
        this.render2D();
      }, { passive: false });

      // Touch controls for mobile
      let touchStartX = 0, touchStartY = 0;
      this.canvas2D.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          touchStartX = e.touches[0].clientX - this.panX;
          touchStartY = e.touches[0].clientY - this.panY;
        }
      });
      this.canvas2D.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
          this.panX = e.touches[0].clientX - touchStartX;
          this.panY = e.touches[0].clientY - touchStartY;
          this.followRobot = false;
          this.updateFollowUI();
          this.render2D();
        }
      });
    }

    // 3D Orbit Controls
    if (this.canvas3D) {
      this.canvas3D.addEventListener('mousedown', (e) => {
        this.orbit3D.isMouseDown = true;
        this.orbit3D.prevMouseX = e.clientX;
        this.orbit3D.prevMouseY = e.clientY;
      });

      window.addEventListener('mousemove', (e) => {
        if (!this.orbit3D.isMouseDown) return;
        const deltaX = e.clientX - this.orbit3D.prevMouseX;
        const deltaY = e.clientY - this.orbit3D.prevMouseY;
        this.orbit3D.prevMouseX = e.clientX;
        this.orbit3D.prevMouseY = e.clientY;

        this.orbit3D.theta -= deltaX * 0.008;
        this.orbit3D.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, this.orbit3D.phi + deltaY * 0.008));
        this.update3DCamera();
      });

      window.addEventListener('mouseup', () => {
        this.orbit3D.isMouseDown = false;
      });

      this.canvas3D.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.orbit3D.radius = Math.max(3.0, Math.min(50.0, this.orbit3D.radius + (e.deltaY > 0 ? 1.5 : -1.5)));
        this.update3DCamera();
      }, { passive: false });
    }

    // Toolbar buttons
    const btnCenter = document.getElementById('btn-map-center');
    if (btnCenter) {
      btnCenter.addEventListener('click', () => {
        this.centerOnRobot();
      });
    }

    const btnFollow = document.getElementById('btn-map-follow');
    if (btnFollow) {
      btnFollow.addEventListener('click', () => {
        this.followRobot = !this.followRobot;
        this.updateFollowUI();
        if (this.followRobot) this.centerOnRobot();
      });
    }

    const btnResetZoom = document.getElementById('btn-map-reset');
    if (btnResetZoom) {
      btnResetZoom.addEventListener('click', () => {
        this.scale = 25.0;
        this.centerOnRobot();
      });
    }

    // Toggle 2D / 3D Fullscreen view
    const btnToggleLayout = document.getElementById('btn-toggle-map-layout');
    if (btnToggleLayout) {
      btnToggleLayout.addEventListener('click', () => {
        const container = document.getElementById('mapping-split-container');
        if (container) {
          container.classList.toggle('view-3d-maximized');
          setTimeout(() => {
            this.resize2D();
            if (this.renderer3D && this.canvas3D) {
              const r = this.canvas3D.parentElement.getBoundingClientRect();
              this.renderer3D.setSize(r.width, r.height);
              this.camera3D.aspect = r.width / r.height;
              this.camera3D.updateProjectionMatrix();
            }
          }, 300);
        }
      });
    }
  },

  centerOnRobot() {
    if (!this.canvas2D) return;
    this.panX = this.canvas2D.width / 2 - this.robotPose.x * this.scale;
    this.panY = this.canvas2D.height / 2 + this.robotPose.y * this.scale;
    this.render2D();
  },

  updateFollowUI() {
    const btn = document.getElementById('btn-map-follow');
    if (btn) {
      if (this.followRobot) {
        btn.classList.add('active');
        btn.textContent = 'Follow: ON';
      } else {
        btn.classList.remove('active');
        btn.textContent = 'Follow: OFF';
      }
    }
  },

  bindROS() {
    if (!window.ROSBridge) return;

    // 1. Process /map
    window.ROSBridge.on('map', (msg) => {
      this.updateOccupancyGrid(msg);
    });

    // 2. Process /scan_filtered
    window.ROSBridge.on('scan', (msg) => {
      this.lastScan = msg;
      this.update3DScan(msg);
      this.render2D();
    });

    // 3. Process /odometry/filtered
    window.ROSBridge.on('odom', (msg) => {
      const pos = msg.pose.pose.position;
      const q = msg.pose.pose.orientation;

      // Calculate yaw from quaternion
      const siny_cosp = 2 * (q.w * q.z + q.x * q.y);
      const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z);
      const yaw = Math.atan2(siny_cosp, cosy_cosp);

      this.robotPose.x = pos.x;
      this.robotPose.y = pos.y;
      this.robotPose.yaw = yaw;

      // Add to trail (throttle by distance)
      const lastPoint = this.poseTrail[this.poseTrail.length - 1];
      if (!lastPoint || Math.hypot(lastPoint.x - pos.x, lastPoint.y - pos.y) > 0.08) {
        this.poseTrail.push({ x: pos.x, y: pos.y });
        if (this.poseTrail.length > 500) this.poseTrail.shift();
      }

      // Update 3D Robot Pose
      if (this.robotMesh3D) {
        this.robotMesh3D.position.set(pos.x, pos.y, 0);
        this.robotMesh3D.rotation.z = yaw;
      }

      if (this.followRobot) {
        this.centerOnRobot();
      } else {
        this.render2D();
      }
    });
  },

  updateOccupancyGrid(msg) {
    this.mapData = msg;
    const { width, height, resolution } = msg.info;
    const origin = msg.info.origin.position;

    // Render occupancy grid into offscreen canvas
    this.mapOffscreenCanvas.width = width;
    this.mapOffscreenCanvas.height = height;
    const offCtx = this.mapOffscreenCanvas.getContext('2d');
    const imgData = offCtx.createImageData(width, height);
    const data = msg.data;

    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      const p = i * 4;

      if (val === -1) {
        // Unknown: soft dark blue/slate
        imgData.data[p] = 20;
        imgData.data[p + 1] = 27;
        imgData.data[p + 2] = 45;
        imgData.data[p + 3] = 220;
      } else if (val === 0) {
        // Free: crisp light gray
        imgData.data[p] = 226;
        imgData.data[p + 1] = 232;
        imgData.data[p + 2] = 240;
        imgData.data[p + 3] = 255;
      } else {
        // Occupied/obstacle: black/dark slate
        const intensity = Math.round(val * 2.55);
        imgData.data[p] = 15;
        imgData.data[p + 1] = 23;
        imgData.data[p + 2] = 42;
        imgData.data[p + 3] = 255;
      }
    }

    offCtx.putImageData(imgData, 0, 0);
    this.render2D();
  },

  update3DScan(msg) {
    if (!this.lidarPoints3D) return;
    const positions = this.lidarPoints3D.geometry.attributes.position.array;
    const angleMin = msg.angle_min;
    const angleInc = msg.angle_increment;
    const ranges = msg.ranges;
    let idx = 0;

    for (let i = 0; i < ranges.length; i += 2) {
      const r = ranges[i];
      if (r >= msg.range_min && r <= msg.range_max) {
        const angle = angleMin + i * angleInc + this.robotPose.yaw;
        positions[idx++] = this.robotPose.x + r * Math.cos(angle);
        positions[idx++] = this.robotPose.y + r * Math.sin(angle);
        positions[idx++] = 0.45; // RPLIDAR S3 mount height
      }
      if (idx >= positions.length - 3) break;
    }

    // Zero out unused points
    for (let i = idx; i < positions.length; i++) {
      positions[i] = 0;
    }

    this.lidarPoints3D.geometry.attributes.position.needsUpdate = true;
  },

  render2D() {
    if (!this.ctx2D || !this.canvas2D) return;
    const ctx = this.ctx2D;
    const w = this.canvas2D.width;
    const h = this.canvas2D.height;

    ctx.fillStyle = '#0b1120'; // Slate 950 deep space
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(this.panX, this.panY);

    // 1. Draw Grid Lines
    this.drawWorldGrid(ctx);

    // 2. Draw 2D Occupancy Grid Map
    if (this.mapData && this.mapOffscreenCanvas) {
      const info = this.mapData.info;
      const origin = info.origin.position;
      const res = info.resolution;

      ctx.save();
      // ROS Map origin is in world coordinates; invert Y for screen coords
      ctx.scale(this.scale * res, -this.scale * res);
      ctx.translate(origin.x / res, -origin.y / res - this.mapOffscreenCanvas.height);
      ctx.drawImage(this.mapOffscreenCanvas, 0, 0);
      ctx.restore();
    }

    // 3. Draw Vehicle Trajectory Trail
    if (this.poseTrail.length > 1) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.0;
      ctx.beginPath();
      for (let i = 0; i < this.poseTrail.length; i++) {
        const pt = this.poseTrail[i];
        const sx = pt.x * this.scale;
        const sy = -pt.y * this.scale;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
    }

    // 4. Draw Real-time LiDAR Scan Points (/scan_filtered)
    if (this.lastScan) {
      const scan = this.lastScan;
      const angleMin = scan.angle_min;
      const angleInc = scan.angle_increment;
      const ranges = scan.ranges;

      ctx.fillStyle = '#00f5d4'; // Bright Cyan
      for (let i = 0; i < ranges.length; i++) {
        const r = ranges[i];
        if (r >= scan.range_min && r <= scan.range_max) {
          const angle = angleMin + i * angleInc + this.robotPose.yaw;
          const px = (this.robotPose.x + r * Math.cos(angle)) * this.scale;
          const py = -(this.robotPose.y + r * Math.sin(angle)) * this.scale;
          ctx.beginPath();
          ctx.arc(px, py, 2.0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 5. Draw Vehicle Body & Direction Arrow
    this.drawRobot(ctx, this.robotPose.x * this.scale, -this.robotPose.y * this.scale, this.robotPose.yaw);

    ctx.restore();
  },

  drawWorldGrid(ctx) {
    const gridSize = 1.0 * this.scale; // 1 meter per major line
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;

    const startX = -this.panX;
    const startY = -this.panY;
    const endX = startX + this.canvas2D.width;
    const endY = startY + this.canvas2D.height;

    ctx.beginPath();
    for (let x = Math.floor(startX / gridSize) * gridSize; x < endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = Math.floor(startY / gridSize) * gridSize; y < endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();
  },

  drawRobot(ctx, x, y, yaw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-yaw); // Invert yaw because screen Y is inverted

    // Vehicle chassis box
    const length = 1.2 * this.scale;
    const width = 0.7 * this.scale;

    ctx.fillStyle = '#0284c7'; // Sky Blue
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.roundRect(-length * 0.3, -width / 2, length, width, 4);
    ctx.fill();
    ctx.stroke();

    // Directional triangle pointer
    ctx.fillStyle = '#f59e0b'; // Gold
    ctx.beginPath();
    ctx.moveTo(length * 0.7, 0);
    ctx.lineTo(length * 0.4, -width * 0.3);
    ctx.lineTo(length * 0.4, width * 0.3);
    ctx.closePath();
    ctx.fill();

    // Wheels
    ctx.fillStyle = '#0f172a';
    const wheelW = width * 0.25;
    const wheelL = length * 0.3;
    ctx.fillRect(length * 0.3, -width / 2 - 3, wheelL, wheelW);
    ctx.fillRect(length * 0.3, width / 2 - wheelW + 3, wheelL, wheelW);
    ctx.fillRect(-length * 0.25, -width / 2 - 3, wheelL, wheelW);
    ctx.fillRect(-length * 0.25, width / 2 - wheelW + 3, wheelL, wheelW);

    ctx.restore();
  }
};

window.MapRenderer = MapRenderer;
