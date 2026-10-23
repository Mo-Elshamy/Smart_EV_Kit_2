/**
 * Smart EV Buggy - 2D SLAM & 3D WebGL Mapping Visualizer
 * Full 3D Point Cloud Mapping, 3D Occupancy Grid Mesh, Elevated Obstacle Walls,
 * Persistent LiDAR Sweep Accumulation, and Stereolabs ZED 2i Depth Point Cloud
 */

const MapRenderer = {
  // =========================================================================
  // 1. 2D Canvas State
  // =========================================================================
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

  // =========================================================================
  // 2. 3D Three.js State
  // =========================================================================
  canvas3D: null,
  scene3D: null,
  camera3D: null,
  renderer3D: null,
  robotMesh3D: null,
  is3DInitialized: false,

  // 3D Layers
  mapMesh3D: null,           // 3D textured ground plane of occupancy grid
  mapTexture3D: null,
  mapObstacles3D: null,      // 3D elevated obstacle wall columns
  lidarPoints3D: null,       // Real-time single-sweep LiDAR scan ring
  lidarAccumPoints3D: null,  // Persistent accumulated 3D LiDAR point cloud map
  zedPoints3D: null,         // Stereolabs ZED 2i registered 3D depth point cloud

  // Buffer capacities
  MAX_LIVE_SCAN_POINTS: 2000,
  MAX_ACCUM_POINTS: 30000,
  MAX_OBSTACLE_POINTS: 50000,
  MAX_ZED_POINTS: 25000,

  accumIndex: 0,
  accumCount: 0,
  lastAccumPose: { x: null, y: null, yaw: null },

  // 3D Orbit Controls
  orbit3D: {
    isMouseDown: false,
    prevMouseX: 0,
    prevMouseY: 0,
    touchStartDist: 0,
    theta: 0.8,       // Azimuth around Z (radians)
    phi: 1.05,        // Polar tilt from +Z (radians, ~60 deg isometric)
    radius: 14.0,     // Distance from target
    target: { x: 0, y: 0, z: 0.3 }
  },

  // =========================================================================
  // Initialization
  // =========================================================================
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

    // 1. Scene & Camera (ROS standard: Z is UP)
    this.scene3D = new THREE.Scene();
    this.scene3D.background = new THREE.Color(0x0a0f1d); // Deep cosmic slate

    this.camera3D = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    this.camera3D.up.set(0, 0, 1); // Set Z as vertical axis in Three.js
    this.update3DCamera();

    // 2. WebGL Renderer
    this.renderer3D = new THREE.WebGLRenderer({
      canvas: this.canvas3D,
      antialias: true,
      alpha: true
    });
    this.renderer3D.setSize(width, height);
    this.renderer3D.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene3D.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    dirLight.position.set(10, -10, 20);
    this.scene3D.add(dirLight);

    // 4. Ground Grid (XY Plane)
    const gridHelper = new THREE.GridHelper(40, 40, 0x38bdf8, 0x1e293b);
    gridHelper.rotation.x = Math.PI / 2; // Lie flat on XY plane
    gridHelper.position.z = -0.02;
    this.scene3D.add(gridHelper);

    // 5. Vehicle 3D Representation
    const carGroup = new THREE.Group();

    // Buggy Chassis
    const bodyGeo = new THREE.BoxGeometry(1.0, 0.6, 0.25);
    const bodyMat = new THREE.MeshPhongMaterial({ color: 0x0284c7, wireframe: false });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.set(0, 0, 0.15);
    carGroup.add(bodyMesh);

    // Cabin / Roll cage roof
    const roofGeo = new THREE.BoxGeometry(0.5, 0.5, 0.2);
    const roofMat = new THREE.MeshPhongMaterial({ color: 0x0369a1 });
    const roofMesh = new THREE.Mesh(roofGeo, roofMat);
    roofMesh.position.set(-0.05, 0, 0.32);
    carGroup.add(roofMesh);

    // 4 Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12);
    wheelGeo.rotateX(Math.PI / 2);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const wheelOffsets = [
      [0.35, 0.32, 0.12],
      [0.35, -0.32, 0.12],
      [-0.35, 0.32, 0.12],
      [-0.35, -0.32, 0.12]
    ];
    wheelOffsets.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(wx, wy, wz);
      carGroup.add(wheel);
    });

    // Heading Arrow (Points forward along +X)
    const coneGeo = new THREE.ConeGeometry(0.14, 0.35, 10);
    coneGeo.rotateZ(-Math.PI / 2); // Rotate cone apex to point along +X
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    coneMesh.position.set(0.68, 0, 0.15);
    carGroup.add(coneMesh);

    // Axes Tripod: Red=X(Forward), Green=Y(Left), Blue=Z(Up)
    const axesHelper = new THREE.AxesHelper(0.7);
    carGroup.add(axesHelper);

    this.robotMesh3D = carGroup;
    this.scene3D.add(this.robotMesh3D);

    // 6. Live LiDAR Scan Ring (Current Sweep at z = 0.45m)
    const liveGeo = new THREE.BufferGeometry();
    liveGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.MAX_LIVE_SCAN_POINTS * 3), 3));
    const liveMat = new THREE.PointsMaterial({
      color: 0x00f5d4,
      size: 0.10,
      transparent: true,
      opacity: 0.95
    });
    this.lidarPoints3D = new THREE.Points(liveGeo, liveMat);
    this.scene3D.add(this.lidarPoints3D);

    // 7. Accumulated 3D LiDAR Point Cloud Map (World Coordinates)
    const accumGeo = new THREE.BufferGeometry();
    accumGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.MAX_ACCUM_POINTS * 3), 3));
    accumGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.MAX_ACCUM_POINTS * 3), 3));
    accumGeo.setDrawRange(0, 0);
    const accumMat = new THREE.PointsMaterial({
      size: 0.07,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });
    this.lidarAccumPoints3D = new THREE.Points(accumGeo, accumMat);
    this.scene3D.add(this.lidarAccumPoints3D);

    // 8. 3D Elevated Obstacle Wall Columns (from 2D SLAM /map occupied cells)
    const obsGeo = new THREE.BufferGeometry();
    obsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.MAX_OBSTACLE_POINTS * 3), 3));
    obsGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.MAX_OBSTACLE_POINTS * 3), 3));
    obsGeo.setDrawRange(0, 0);
    const obsMat = new THREE.PointsMaterial({
      size: 0.09,
      vertexColors: true,
      transparent: true,
      opacity: 0.90
    });
    this.mapObstacles3D = new THREE.Points(obsGeo, obsMat);
    this.scene3D.add(this.mapObstacles3D);

    // 9. Stereolabs ZED 2i Registered 3D Depth Point Cloud
    const zedGeo = new THREE.BufferGeometry();
    zedGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.MAX_ZED_POINTS * 3), 3));
    zedGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.MAX_ZED_POINTS * 3), 3));
    zedGeo.setDrawRange(0, 0);
    const zedMat = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.95
    });
    this.zedPoints3D = new THREE.Points(zedGeo, zedMat);
    this.scene3D.add(this.zedPoints3D);

    this.is3DInitialized = true;
    this.animate3D();
  },

  update3DCamera() {
    if (!this.camera3D) return;
    const { theta, phi, radius, target } = this.orbit3D;
    // Spherical orbit coordinates with Z as vertical UP axis
    this.camera3D.position.x = target.x + radius * Math.sin(phi) * Math.cos(theta);
    this.camera3D.position.y = target.y + radius * Math.sin(phi) * Math.sin(theta);
    this.camera3D.position.z = target.z + radius * Math.cos(phi);
    this.camera3D.lookAt(target.x, target.y, target.z);
  },

  animate3D() {
    if (!this.is3DInitialized) return;
    requestAnimationFrame(() => this.animate3D());
    if (this.renderer3D && this.scene3D && this.camera3D) {
      this.renderer3D.render(this.scene3D, this.camera3D);
    }
  },

  // =========================================================================
  // Interaction & Event Listeners
  // =========================================================================
  bindEvents() {
    // 2D Canvas Drag and Zoom
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

      // Touch controls for 2D
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

    // 3D Canvas Orbit Controls (Mouse & Touch)
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
        this.orbit3D.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.02, this.orbit3D.phi - deltaY * 0.008));
        this.update3DCamera();
      });

      window.addEventListener('mouseup', () => {
        this.orbit3D.isMouseDown = false;
      });

      this.canvas3D.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.orbit3D.radius = Math.max(2.0, Math.min(60.0, this.orbit3D.radius + (e.deltaY > 0 ? 1.5 : -1.5)));
        this.update3DCamera();
      }, { passive: false });

      // Touch orbit and pinch-zoom for mobile/tablet
      let touchStartDist = 0;
      this.canvas3D.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          this.orbit3D.isMouseDown = true;
          this.orbit3D.prevMouseX = e.touches[0].clientX;
          this.orbit3D.prevMouseY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
          this.orbit3D.isMouseDown = false;
          touchStartDist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
        }
      });

      this.canvas3D.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1 && this.orbit3D.isMouseDown) {
          const deltaX = e.touches[0].clientX - this.orbit3D.prevMouseX;
          const deltaY = e.touches[0].clientY - this.orbit3D.prevMouseY;
          this.orbit3D.prevMouseX = e.touches[0].clientX;
          this.orbit3D.prevMouseY = e.touches[0].clientY;

          this.orbit3D.theta -= deltaX * 0.008;
          this.orbit3D.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.02, this.orbit3D.phi - deltaY * 0.008));
          this.update3DCamera();
        } else if (e.touches.length === 2) {
          const dist = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
          );
          const diff = touchStartDist - dist;
          touchStartDist = dist;
          this.orbit3D.radius = Math.max(2.0, Math.min(60.0, this.orbit3D.radius + diff * 0.05));
          this.update3DCamera();
        }
      });

      this.canvas3D.addEventListener('touchend', () => {
        this.orbit3D.isMouseDown = false;
      });
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
        this.orbit3D.radius = 14.0;
        this.orbit3D.theta = 0.8;
        this.orbit3D.phi = 1.05;
        this.centerOnRobot();
        this.update3DCamera();
      });
    }

    const btnClear3D = document.getElementById('btn-map-clear-3d');
    if (btnClear3D) {
      btnClear3D.addEventListener('click', () => {
        this.clear3DAccumulation();
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
    if (this.canvas2D) {
      this.panX = this.canvas2D.width / 2 - this.robotPose.x * this.scale;
      this.panY = this.canvas2D.height / 2 + this.robotPose.y * this.scale;
      this.render2D();
    }
    this.orbit3D.target.x = this.robotPose.x;
    this.orbit3D.target.y = this.robotPose.y;
    this.orbit3D.target.z = 0.3;
    this.update3DCamera();
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

  // =========================================================================
  // ROS Subscriptions Binding
  // =========================================================================
  bindROS() {
    if (!window.ROSBridge) return;

    // 1. Process 2D Occupancy Grid (/map)
    window.ROSBridge.on('map', (msg) => {
      this.updateOccupancyGrid(msg);
    });

    // 2. Process LiDAR Scan (/scan_filtered)
    window.ROSBridge.on('scan', (msg) => {
      this.lastScan = msg;
      this.update3DScan(msg);
      this.render2D();
    });

    // 3. Process Robot Odometry (/odometry/filtered)
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

      // Add to trajectory trail
      const lastPoint = this.poseTrail[this.poseTrail.length - 1];
      if (!lastPoint || Math.hypot(lastPoint.x - pos.x, lastPoint.y - pos.y) > 0.08) {
        this.poseTrail.push({ x: pos.x, y: pos.y });
        if (this.poseTrail.length > 600) this.poseTrail.shift();
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

    // 4. Process Stereolabs ZED 2i 3D Point Cloud (/zed/zed_node/point_cloud/cloud_registered)
    window.ROSBridge.on('pointcloud', (msg) => {
      this.updateZEDPointCloud(msg);
    });
  },

  // =========================================================================
  // 3D SLAM Map & Obstacle Rendering
  // =========================================================================
  updateOccupancyGrid(msg) {
    this.mapData = msg;
    const { width, height, resolution } = msg.info;
    const origin = msg.info.origin.position;

    // Render 2D occupancy grid into offscreen canvas
    this.mapOffscreenCanvas.width = width;
    this.mapOffscreenCanvas.height = height;
    const offCtx = this.mapOffscreenCanvas.getContext('2d');
    const imgData = offCtx.createImageData(width, height);
    const data = msg.data;

    for (let i = 0; i < data.length; i++) {
      const val = data[i];
      const p = i * 4;

      if (val === -1) {
        // Unknown: soft dark slate/blue
        imgData.data[p] = 20;
        imgData.data[p + 1] = 27;
        imgData.data[p + 2] = 45;
        imgData.data[p + 3] = 210;
      } else if (val === 0) {
        // Free space: crisp light gray
        imgData.data[p] = 226;
        imgData.data[p + 1] = 232;
        imgData.data[p + 2] = 240;
        imgData.data[p + 3] = 255;
      } else {
        // Occupied/obstacle: deep charcoal black
        imgData.data[p] = 15;
        imgData.data[p + 1] = 23;
        imgData.data[p + 2] = 42;
        imgData.data[p + 3] = 255;
      }
    }

    offCtx.putImageData(imgData, 0, 0);

    // Update 3D textured ground plane
    this.update3DMapMesh(msg);

    // Update 3D elevated obstacle wall columns
    this.update3DObstacleWalls(msg);

    this.render2D();
  },

  update3DMapMesh(msg) {
    if (!this.scene3D) return;
    const { width, height, resolution } = msg.info;
    const origin = msg.info.origin.position;
    const worldW = width * resolution;
    const worldH = height * resolution;

    if (!this.mapTexture3D) {
      this.mapTexture3D = new THREE.CanvasTexture(this.mapOffscreenCanvas);
      this.mapTexture3D.minFilter = THREE.NearestFilter;
      this.mapTexture3D.magFilter = THREE.NearestFilter;

      const planeGeo = new THREE.PlaneGeometry(worldW, worldH);
      const planeMat = new THREE.MeshBasicMaterial({
        map: this.mapTexture3D,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      this.mapMesh3D = new THREE.Mesh(planeGeo, planeMat);
      this.scene3D.add(this.mapMesh3D);
    } else {
      // Re-geometry if dimensions changed
      if (this.mapMesh3D.geometry.parameters.width !== worldW ||
          this.mapMesh3D.geometry.parameters.height !== worldH) {
        this.mapMesh3D.geometry.dispose();
        this.mapMesh3D.geometry = new THREE.PlaneGeometry(worldW, worldH);
      }
      this.mapTexture3D.needsUpdate = true;
    }

    // Position center of plane in ROS coordinates
    this.mapMesh3D.position.set(
      origin.x + worldW / 2,
      origin.y + worldH / 2,
      -0.01
    );
  },

  update3DObstacleWalls(msg) {
    if (!this.mapObstacles3D) return;
    const { width, height, resolution } = msg.info;
    const origin = msg.info.origin.position;
    const data = msg.data;

    const posAttr = this.mapObstacles3D.geometry.attributes.position;
    const colAttr = this.mapObstacles3D.geometry.attributes.color;
    const posArr = posAttr.array;
    const colArr = colAttr.array;

    let pIdx = 0;
    const heights = [0.08, 0.22, 0.38, 0.54, 0.70]; // 5 vertical layers of holographic walls

    // Stride through grid to keep 60 FPS
    for (let y = 0; y < height; y += 2) {
      for (let x = 0; x < width; x += 2) {
        const val = data[y * width + x];
        if (val >= 65) {
          const wx = origin.x + (x + 0.5) * resolution;
          const wy = origin.y + (y + 0.5) * resolution;

          for (let h = 0; h < heights.length; h++) {
            if (pIdx + 3 >= posArr.length) break;
            const wz = heights[h];

            posArr[pIdx] = wx;
            posArr[pIdx + 1] = wy;
            posArr[pIdx + 2] = wz;

            // Height-based cyberpunk neon gradient (Cyan -> Electric Blue)
            const t = wz / 0.70;
            colArr[pIdx] = 0.05 + 0.15 * t;      // R
            colArr[pIdx + 1] = 0.95 - 0.25 * t;  // G
            colArr[pIdx + 2] = 0.85 + 0.15 * t;  // B

            pIdx += 3;
          }
        }
        if (pIdx + 15 >= posArr.length) break;
      }
      if (pIdx + 15 >= posArr.length) break;
    }

    this.mapObstacles3D.geometry.setDrawRange(0, pIdx / 3);
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  },

  // =========================================================================
  // 3D LiDAR Scan & Persistent Point Cloud Accumulator
  // =========================================================================
  update3DScan(msg) {
    if (!this.lidarPoints3D) return;
    const livePos = this.lidarPoints3D.geometry.attributes.position.array;
    const angleMin = msg.angle_min;
    const angleInc = msg.angle_increment;
    const ranges = msg.ranges;
    let liveIdx = 0;

    // Check if buggy has moved enough to accumulate world points
    const dist = this.lastAccumPose.x === null ? 999 :
      Math.hypot(this.robotPose.x - this.lastAccumPose.x, this.robotPose.y - this.lastAccumPose.y);
    const dYaw = this.lastAccumPose.yaw === null ? 999 :
      Math.abs(this.robotPose.yaw - this.lastAccumPose.yaw);
    const shouldAccumulate = (dist > 0.05 || dYaw > 0.04);

    if (shouldAccumulate) {
      this.lastAccumPose.x = this.robotPose.x;
      this.lastAccumPose.y = this.robotPose.y;
      this.lastAccumPose.yaw = this.robotPose.yaw;
    }

    const accumPosAttr = this.lidarAccumPoints3D ? this.lidarAccumPoints3D.geometry.attributes.position : null;
    const accumColAttr = this.lidarAccumPoints3D ? this.lidarAccumPoints3D.geometry.attributes.color : null;

    for (let i = 0; i < ranges.length; i += 2) {
      const r = ranges[i];
      if (r >= msg.range_min && r <= msg.range_max) {
        const angle = angleMin + i * angleInc + this.robotPose.yaw;
        const wx = this.robotPose.x + r * Math.cos(angle);
        const wy = this.robotPose.y + r * Math.sin(angle);
        const wz = 0.45; // RPLIDAR S3 mount height

        // 1. Live sweep ring
        if (liveIdx < livePos.length - 3) {
          livePos[liveIdx++] = wx;
          livePos[liveIdx++] = wy;
          livePos[liveIdx++] = wz;
        }

        // 2. Persistent 3D Point Cloud Map accumulation
        if (shouldAccumulate && accumPosAttr && r < msg.range_max - 0.2) {
          const aIdx = (this.accumIndex % this.MAX_ACCUM_POINTS) * 3;
          accumPosAttr.array[aIdx] = wx;
          accumPosAttr.array[aIdx + 1] = wy;
          accumPosAttr.array[aIdx + 2] = wz + (Math.random() - 0.5) * 0.04; // Micro depth texture

          // Color: bright neon cyan/green
          accumColAttr.array[aIdx] = 0.00;     // R
          accumColAttr.array[aIdx + 1] = 0.90; // G
          accumColAttr.array[aIdx + 2] = 0.65; // B

          this.accumIndex++;
          if (this.accumCount < this.MAX_ACCUM_POINTS) {
            this.accumCount++;
          }
        }
      }
    }

    // Zero out unused points in live sweep
    for (let i = liveIdx; i < livePos.length; i++) {
      livePos[i] = 0;
    }
    this.lidarPoints3D.geometry.attributes.position.needsUpdate = true;

    // Update accumulated buffer draw range
    if (shouldAccumulate && accumPosAttr && accumColAttr) {
      accumPosAttr.needsUpdate = true;
      accumColAttr.needsUpdate = true;
      this.lidarAccumPoints3D.geometry.setDrawRange(0, this.accumCount);
    }
  },

  clear3DAccumulation() {
    this.accumIndex = 0;
    this.accumCount = 0;
    this.lastAccumPose = { x: null, y: null, yaw: null };
    if (this.lidarAccumPoints3D) {
      this.lidarAccumPoints3D.geometry.setDrawRange(0, 0);
      this.lidarAccumPoints3D.geometry.attributes.position.needsUpdate = true;
    }
    if (this.zedPoints3D) {
      this.zedPoints3D.geometry.setDrawRange(0, 0);
      this.zedPoints3D.geometry.attributes.position.needsUpdate = true;
    }
    console.log('[MapRenderer] 3D Point Cloud Buffers Cleared');
  },

  // =========================================================================
  // Stereolabs ZED 2i 3D Point Cloud Decoder
  // =========================================================================
  updateZEDPointCloud(msg) {
    if (!this.zedPoints3D || !msg || !msg.data) return;

    // 1. Decode binary buffer from base64 string or ArrayBuffer
    let buffer;
    if (typeof msg.data === 'string') {
      const binStr = atob(msg.data);
      const bytes = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        bytes[i] = binStr.charCodeAt(i);
      }
      buffer = bytes.buffer;
    } else if (msg.data.buffer instanceof ArrayBuffer) {
      buffer = msg.data.buffer;
    } else if (msg.data instanceof ArrayBuffer) {
      buffer = msg.data;
    } else {
      return;
    }

    const dataView = new DataView(buffer);
    const pointStep = msg.point_step || 16;
    const isLittleEndian = !msg.is_bigendian;

    // 2. Locate field offsets
    let xOff = 0, yOff = 4, zOff = 8, rgbOff = -1;
    if (msg.fields && Array.isArray(msg.fields)) {
      for (let f of msg.fields) {
        if (f.name === 'x') xOff = f.offset;
        else if (f.name === 'y') yOff = f.offset;
        else if (f.name === 'z') zOff = f.offset;
        else if (f.name === 'rgb' || f.name === 'rgba') rgbOff = f.offset;
      }
    }

    const totalPoints = Math.floor(buffer.byteLength / pointStep);
    if (totalPoints <= 0) return;

    // Downsample stride to stay within MAX_ZED_POINTS and maintain 60 FPS
    const stride = Math.max(1, Math.floor(totalPoints / this.MAX_ZED_POINTS));
    const isOptical = msg.header && msg.header.frame_id && msg.header.frame_id.includes('optical');

    const posAttr = this.zedPoints3D.geometry.attributes.position;
    const colAttr = this.zedPoints3D.geometry.attributes.color;
    const posArr = posAttr.array;
    const colArr = colAttr.array;

    const cosY = Math.cos(this.robotPose.yaw);
    const sinY = Math.sin(this.robotPose.yaw);

    // ZED 2i physical mount offset on buggy (URDF camera_joint: 1.25m, 0m, 0.35m)
    const camMountX = 1.25;
    const camMountY = 0.00;
    const camMountZ = 0.35;

    let pIdx = 0;

    for (let i = 0; i < totalPoints; i += stride) {
      const bOff = i * pointStep;
      if (bOff + 12 > buffer.byteLength) break;

      const rawX = dataView.getFloat32(bOff + xOff, isLittleEndian);
      const rawY = dataView.getFloat32(bOff + yOff, isLittleEndian);
      const rawZ = dataView.getFloat32(bOff + zOff, isLittleEndian);

      // Filter NaNs, infinities, and invalid stereo depth points
      if (isNaN(rawX) || isNaN(rawY) || isNaN(rawZ) || !isFinite(rawX) || !isFinite(rawY) || !isFinite(rawZ)) {
        continue;
      }

      // Convert from camera frame to vehicle base_link frame
      let bx, by, bz;
      if (isOptical) {
        // Optical frame: Z-forward, X-right, Y-down
        bx = rawZ + camMountX;
        by = -rawX + camMountY;
        bz = -rawY + camMountZ;
      } else {
        // Standard ROS camera frame: X-forward, Y-left, Z-up
        bx = rawX + camMountX;
        by = rawY + camMountY;
        bz = rawZ + camMountZ;
      }

      // Transform from vehicle base_link to world frame
      const wx = this.robotPose.x + bx * cosY - by * sinY;
      const wy = this.robotPose.y + bx * sinY + by * cosY;
      const wz = bz;

      if (pIdx + 3 >= posArr.length) break;

      posArr[pIdx] = wx;
      posArr[pIdx + 1] = wy;
      posArr[pIdx + 2] = wz;

      // Color extraction (RGB if present, otherwise depth/height colormap)
      if (rgbOff >= 0 && bOff + rgbOff + 4 <= buffer.byteLength) {
        const rgbInt = dataView.getUint32(bOff + rgbOff, isLittleEndian);
        colArr[pIdx] = ((rgbInt >> 16) & 0xff) / 255.0;     // R
        colArr[pIdx + 1] = ((rgbInt >> 8) & 0xff) / 255.0;  // G
        colArr[pIdx + 2] = (rgbInt & 0xff) / 255.0;         // B
      } else {
        // Height-based colormap: ground dark violet to high neon amber
        const t = Math.max(0, Math.min(1, wz / 1.5));
        colArr[pIdx] = 0.2 + 0.8 * t;
        colArr[pIdx + 1] = 0.4 + 0.5 * (1 - t);
        colArr[pIdx + 2] = 0.9 * (1 - t);
      }

      pIdx += 3;
    }

    this.zedPoints3D.geometry.setDrawRange(0, pIdx / 3);
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  },

  // =========================================================================
  // 2D Canvas Map & HUD Rendering
  // =========================================================================
  render2D() {
    if (!this.ctx2D || !this.canvas2D) return;
    const ctx = this.ctx2D;
    const w = this.canvas2D.width;
    const h = this.canvas2D.height;

    ctx.fillStyle = '#0b1120'; // Slate 950 deep space
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(this.panX, this.panY);

    // 1. Draw World Grid Lines
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

    // 5. Draw Vehicle Body & Heading Arrow
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
