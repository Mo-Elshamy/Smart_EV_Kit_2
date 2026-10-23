# Smart EV Kit 2 — Autonomous EV Sensor Rig & Bringup

Upgraded Smart EV sensor rig with kinematics, transform pipelines, hardware drivers, and launch files for ROS 2 (Jazzy / Humble).

---

## 📋 Table of Contents
- [Architecture & Package Structure](#architecture--package-structure)
- [Hardware Interfaces & Ports Summary](#hardware-interfaces--ports-summary)
- [System Prerequisites & Installation](#system-prerequisites--installation)
- [Changelog & Key Problem Fixes](#changelog--key-problem-fixes)
- [Running & Testing the System](#running--testing-the-system)
  - [1. Kinematic TF2 Frames & RViz](#1-kinematic-tf2-frames--rviz)
  - [2. GNSS / GPS Testing (Holybro M9N)](#2-gnss--gps-testing-holybro-m9n)
  - [3. 2D LiDAR Testing (Slamtec RPLIDAR S3)](#3-2d-lidar-testing-slamtec-rplidar-s3)
  - [4. IMU 9-Axis Testing & 3D RViz (WitMotion WT901)](#4-imu-9-axis-testing--3d-rviz-witmotion-wt901)
  - [5. Combined Telemetry Bringup (GPS + IMU)](#5-combined-telemetry-bringup-gps--imu)
  - [6. Stereo Depth Camera Testing (Stereolabs ZED 2i)](#6-stereo-depth-camera-testing-stereolabs-zed-2i)
  - [7. Multi-Sensor Localization & EKF Fusion (Stage 5)](#7-multi-sensor-localization--ekf-fusion-stage-5)
  - [8. 2D Online SLAM Mapping (Stage 6)](#8-2d-online-slam-mapping-stage-6)
  - [9. Telemetry Bridges, Web Command Center, & Master Launch (Stage 7)](#9-telemetry-bridges-web-command-center--master-launch-stage-7)
- [Udev Rules (Persistent Device Names)](#udev-rules-persistent-device-names)

---

## 🏗 Architecture & Package Structure

```text
src/Smart_EV_Kit_2/
├── ev_description/             # Kinematic tree (URDF/xacro) & coordinate frames
│   ├── urdf/
│   │   ├── ev_buggy.urdf.xacro # Base robot root (base_link)
│   │   └── sensor_mounts.xacro # Transforms for LiDAR, IMU, GPS, and ZED Camera
│   └── CMakeLists.txt, package.xml
├── ev_bringup/                 # Launch files, configurations, RViz profiles
│   ├── launch/
│   │   ├── sensors_all.launch.py            # Master all-sensor launcher (LiDAR + IMU + GPS + ZED)
│   │   ├── lidar.launch.py                  # Standalone RPLIDAR S3 + roll-cage pillar filter
│   │   ├── imu.launch.py                    # Standalone WitMotion WT901 IMU + orientation
│   │   ├── gps.launch.py                    # Standalone Holybro M9N GNSS driver
│   │   ├── depth_camera.launch.py           # ZED 2i Stereo Depth + RGB + PointCloud
│   │   ├── web_video.launch.py              # MJPEG video streamer (:8080) + rosbridge (:9090)
│   │   ├── web_dashboard.launch.py          # Web Command Center HTTP server (:3000)
│   │   ├── system_web.launch.py             # MASTER OPTION 1: Full System with Web Command Center
│   │   ├── system_rviz.launch.py            # MASTER OPTION 2: Full System with Dedicated RViz 2
│   │   └── system_core.launch.py            # Unified system bringup with flexible flags
│   ├── config/
│   │   ├── full_system_rviz.rviz            # All-inclusive RViz profile (TF, Model, RGB, Depth, 3D Cloud, IMU, Scans, Odom, GPS, Map)
│   │   ├── rviz_config.rviz                 # Standard RViz layout
│   │   ├── rviz_imu.rviz                    # Dedicated 3D orientation visualizer profile
│   │   ├── laser_filter_params.yaml         # Angular bounds filter for roll-cage pillars
│   │   └── zed2i_params.yaml                # ZED 2i camera and CUDA depth tuning overrides
│   ├── scripts/
│   │   ├── imu_tf_broadcaster.py            # Dynamic 3D TF orientation broadcaster for RViz
│   │   ├── setup_imu.sh                     # Automated CH340 kernel module & udev installer
│   │   ├── setup_gps.sh                     # Persistent FTDI udev rule installer for Holybro M9N
│   │   └── setup_lidar.sh                   # Persistent CP2102 udev rule installer for Slamtec S3
│   └── CMakeLists.txt, package.xml
├── ev_localization/            # Sensor fusion & SLAM state estimation (Stages 5 & 6)
│   ├── launch/
│   │   ├── localization.launch.py       # Stage 5: EKF + NavSat + State Publisher + RViz
│   │   └── mapping_slam.launch.py       # Stage 6: Online async SLAM Toolbox + EKF + Scan
│   ├── config/
│   │   ├── ekf_fusion_params.yaml       # robot_localization EKF (ZED + IMU + GPS) config
│   │   └── slam_toolbox_params.yaml     # slam_toolbox 2D mapping parameters
│   └── CMakeLists.txt, package.xml
├── ev_web_dashboard/           # Stage 7: Zero-install Web Command Center
│   ├── launch/
│   │   └── web_dashboard.launch.py      # Standalone HTTP web server launcher
│   ├── scripts/
│   │   └── http_server_node.py          # Python multithreaded HTTP server (:3000)
│   ├── www/                             # Responsive web frontend (Zero CDN dependencies)
│   │   ├── index.html                   # Command center layout (Desktop 3-column / Mobile 3-tab)
│   │   ├── css/
│   │   │   ├── dashboard.css            # Glassmorphic dark styling & responsive grid
│   │   │   └── vendor/leaflet.css       # Bundled Leaflet styles
│   │   ├── js/
│   │   │   ├── app.js                   # Master dashboard logic & MJPEG stream binder
│   │   │   ├── ros_bridge.js            # Dynamic host roslibjs WebSocket connector (:9090)
│   │   │   ├── map_renderer.js          # 2D Canvas SLAM & Three.js 3D spatial visualizer
│   │   │   ├── telemetry_hud.js         # Leaflet GPS map, trail, heading & artificial horizon
│   │   │   └── vendor/                  # Bundled roslib.min.js, three.min.js, leaflet.js
│   │   └── assets/                      # Icons and static web assets
│   └── CMakeLists.txt, package.xml
└── ev_sensors/                 # Hardware driver implementations
    ├── sllidar_ros2/           # Slamtec RPLIDAR C++ driver (S3 / A-series / C-series)
    ├── nmea_navsat_driver/     # Standard NMEA serial GPS driver
    ├── witmotion_ros/          # WitMotion 9-axis IMU driver
    ├── zed-ros2-wrapper/       # Stereolabs ZED camera ROS 2 wrapper
    └── zed-ros2-interfaces/    # Stereolabs custom messages (zed_msgs)
```

---

## 🔌 Hardware Interfaces & Ports Summary

| Sensor | Model | Default Port | Default Baud | Driver Package | Output Topics |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GNSS Receiver** | Holybro M9N (FTDI) | `/dev/ttyUSB0` (or `/dev/ttyGPS`) | **`115200`** | `nmea_navsat_driver` | `/fix`, `/vel`, `/time_reference` |
| **2D LiDAR** | Slamtec RPLIDAR S3 (CP2102N) | `/dev/ttyUSB1` (or `/dev/ttyLIDAR`) | **`1000000`** | `sllidar_ros2` | `/scan`, `/scan_filtered` |
| **IMU (9-Axis)** | WitMotion WT901 (CH340) | `/dev/ttyIMU` (or `/dev/ttyUSB0`) | **`9600`** | `witmotion_ros` | `/imu/data` |
| **Depth Camera** | Stereolabs ZED 2i | USB 3.0 (`/dev/video0`) | N/A | `zed_wrapper` | `/zed/zed_node/rgb/color/rect/image`<br>`/zed/zed_node/image/depth_image`<br>`/zed/zed_node/point_cloud/cloud_registered`<br>`/zed/zed_node/odom` |

---

## 🛠 System Prerequisites & Installation

### 1. Install System ROS 2 & Build Dependencies
```bash
sudo apt update
sudo apt install -y \
  ros-$ROS_DISTRO-xacro \
  ros-$ROS_DISTRO-robot-state-publisher \
  ros-$ROS_DISTRO-joint-state-publisher \
  ros-$ROS_DISTRO-rviz2 \
  ros-$ROS_DISTRO-nmea-navsat-driver \
  ros-$ROS_DISTRO-laser-filters \
  ros-$ROS_DISTRO-zed-description \
  ros-$ROS_DISTRO-rosbridge-server \
  ros-$ROS_DISTRO-web-video-server \
  cuda-toolkit-13-2 \
  libusb-1.0-0-dev \
  zstd
```

### 2. Configure Swap Space on NVIDIA Jetson (Memory Safety)
To prevent the Linux Out-Of-Memory (OOM) killer from terminating compilation on shared Jetson RAM:
```bash
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 3. Install Stereolabs ZED SDK v5.2
Download and install the matching ZED SDK for Jetson L4T:
```bash
wget -O ~/ZED_SDK_Jetson_5.2.run "https://download.stereolabs.com/zedsdk/5.2/l4t36.4/jetsons"
chmod +x ~/ZED_SDK_Jetson_5.2.run
~/ZED_SDK_Jetson_5.2.run -- silent skip_tools
```

### 4. Install WitMotion CH340 Kernel Module & Udev Rule
Stock Jetson Tegra kernels (`6.8.12-tegra`) disable the CH340 module by default. Run the automated installer:
```bash
bash ~/ev_ws/src/Smart_EV_Kit_2/ev_bringup/scripts/setup_imu.sh
```

### 5. Build the Workspace Safely
Always compile with throttled parallel jobs (`-j2` and `--parallel-workers 1`) to keep RAM usage within limits:
```bash
cd ~/ev_ws
source /opt/ros/$ROS_DISTRO/setup.bash
MAKEFLAGS="-j2" colcon build --symlink-install --parallel-workers 1
source install/setup.bash
```

---

## 🔍 Changelog & Key Problem Fixes

During platform bringup on ROS 2 Jazzy, several issues were diagnosed and resolved:

### 1. Launch File Substitution Error (`view_frames.launch.py`)
- **Error:** `Caught exception in launch: executable '[<TextSubstitution object...>]' not found on the PATH`.
- **Root Cause:** Line 24 wrapped `FindExecutable(name='xacro')` in `PathJoinSubstitution([...])`, causing ROS 2 launch to pass an un-evaluated Python object representation string instead of a valid executable name.
- **Fix:** Simplified command substitution to standard `Command(['xacro ', default_xacro_path])`.

### 2. YAML Parameter Parsing Error (`robot_description`)
- **Error:** `Unable to parse the value of parameter robot_description as yaml. If the parameter is meant to be a string, try wrapping it in launch_ros.parameter_descriptions.ParameterValue(value, value_type=str)`.
- **Root Cause:** In modern ROS 2 (Iron/Jazzy), raw XML strings from `Command` are not automatically cast to strings and fail YAML parsing.
- **Fix:** Imported `ParameterValue` and wrapped `Command` with `value_type=str`.

### 3. Modularization of Telemetry Launchers
- **Issue:** Launching `telemetry_sensors.launch.py` with only one sensor connected crashed the launch process because the missing driver couldn't bind to its port.
- **Fix:** 
  - Extracted standalone [`gps.launch.py`](ev_bringup/launch/gps.launch.py) and [`imu.launch.py`](ev_bringup/launch/imu.launch.py).
  - Updated [`telemetry_sensors.launch.py`](ev_bringup/launch/telemetry_sensors.launch.py) to include them conditionally (`use_gps:=true/false`, `use_imu:=true/false`).

### 4. GPS Baud Rate Mismatch & UTF-8 Decoding Error
- **Error:** `nmea_gps_node: Value error, likely due to missing fields in the NMEA message. Error was: 'utf-8' codec can't decode byte 0xb0...`.
- **Root Cause:** The Holybro M9N unit outputted serial data at **`115200` baud** (not `38400`). Reading at 38400 baud received garbled non-ASCII bytes.
- **Fix:** Verified valid NMEA strings (`$GNGGA`, `$GNRMC`) at `115200` baud; updated default baud rate to `115200` across all GPS launch files.

### 5. Slamtec RPLIDAR S3 Communication Error `80008004`
- **Error:** `[sllidar_node]: Error, unexpected error, code: 80008004`.
- **Root Cause:** Code `0x80008004` is `SL_RESULT_OPERATION_NOT_SUPPORT`, which the SDK returns when `!isConnected()`. The Linux port `/dev/ttyUSB1` lacked read/write permissions for the current user (`Permission denied: /dev/ttyUSB1`).
- **Fix:** Granted serial port permissions (`chmod 666 /dev/ttyUSB1`) and added udev rules for persistent `/dev/ttyLIDAR` mapping.

### 6. Jetson Out-Of-Memory (OOM) Build Crashes
- **Issue:** Multi-core `colcon build` triggered the Linux OOM killer, terminating VS Code and terminals due to memory starvation on Jetson's shared 7.3 GB RAM.
- **Fix:** Added an 8 GB persistent swapfile (`/swapfile`) and throttled compilation via `MAKEFLAGS="-j2" colcon build --parallel-workers 1`.

### 7. ZED SDK v5.2 Compatibility & Driver Integration
- **Issue:** `zed-ros2-wrapper` v5.5 requires ZED SDK v5.2 (`sl::CustomObjectDetectionProperties.object_tracking_parameters`).
- **Fix:** Upgraded host SDK to ZED SDK v5.2.3, allowing all packages in `ev_sensors` to compile unmodified from upstream.

### 8. Depth Camera Jitter, Black Screen & Missing RGB View
- **Issue:**
  1. The RGB image did not appear in RViz because `zed-ros2-wrapper` v5.5 modernized the image topic to `/zed/zed_node/rgb/color/rect/image`.
  2. The point cloud feed flickered/turned black with `No transform to fixed frame [base_link]` due to timestamp drift between the camera's internal hardware clock and the host Linux clock.
  3. `depth_mode: 'NEURAL_LIGHT'` failed with `NEURAL TRT NOT FOUND` / `CORRUPTED SDK INSTALLATION` because NVIDIA TensorRT was not installed.
- **Fix:**
  - Configured `depth_mode: 'ULTRA'` in `zed2i_params.yaml`, enabling high-performance, crisp stereo depth running directly on CUDA without TensorRT.
  - Enabled `debug.use_pub_timestamps: true`, locking all message timestamps to current ROS time (`now()`) to eliminate TF extrapolation timeouts.
  - Updated `rviz_config.rviz` to automatically display `/zed/zed_node/rgb/color/rect/image`, colorized depth on `/zed/zed_node/image/depth_image`, and 3D point cloud on `/zed/zed_node/point_cloud/cloud_registered`.

### 9. WitMotion WT901 CH340 Driver & Baud Rate Resolution
- **Issue:**
  1. No `/dev/ttyUSB*` port was created when plugging in the IMU because the stock Jetson kernel disabled `CONFIG_USB_SERIAL_CH341`.
  2. No IMU data was published on `/imu/data` because `witmotion_ros` measurement channels default to `false`.
  3. The IMU axes did not move in RViz because the hardware runs at **`9600` baud** (not `115200`), and `use_native_orientation: true` was waiting for quaternion packets that the sensor does not emit.
- **Fix:**
  - Built and loaded `ch341.ko` for `6.8.12-1021-tegra` and added udev rule `/etc/udev/rules.d/99-witmotion.rules` for `/dev/ttyIMU`.
  - Configured `imu.launch.py` with `baud_rate: 9600`, `timeout_ms: 0`, `use_native_orientation: false`, and enabled all measurement flags (`orientation`, `acceleration`, `angular_velocity`).
  - Implemented [`imu_tf_broadcaster.py`](ev_bringup/scripts/imu_tf_broadcaster.py) and [`rviz_imu.rviz`](ev_bringup/config/rviz_imu.rviz) for live 1:1 real-time 3D orientation visualization in RViz.

---

## 🚀 Running & Testing the System

Make sure your workspace environment is sourced in every new terminal:
```bash
source ~/ev_ws/install/setup.bash
```

### 1. Kinematic TF2 Frames & RViz
Verify the vehicle coordinate frames and sensor mounts:
```bash
ros2 launch ev_bringup view_frames.launch.py
```
*To inspect the transform tree in PDF format:*
```bash
ros2 run tf2_tools view_frames
evince frames.pdf
```

---

### 2. GNSS / GPS Testing (Holybro M9N)
Run the dedicated GPS launch file:
```bash
ros2 launch ev_bringup gps.launch.py port:=/dev/ttyUSB0 baud:=115200
```
**Verify data stream:**
```bash
# Check topics (/fix, /vel, /time_reference)
ros2 topic list

# Echo live coordinates & fix quality
ros2 topic echo /fix

# Check update rate (1 - 5 Hz)
ros2 topic hz /fix
```

---

### 3. 2D LiDAR Testing (Slamtec RPLIDAR S3)

**Grant permissions (if udev rule not installed):**
```bash
sudo chmod 666 /dev/ttyUSB1
```

**Run standalone LiDAR + Roll-cage filter:**
```bash
ros2 launch ev_bringup lidar.launch.py serial_port:=/dev/ttyUSB1
```

**Run LiDAR + Vehicle Kinematics + RViz:**
```bash
ros2 launch ev_bringup lidar.launch.py serial_port:=/dev/ttyUSB1 use_rviz:=true
```

**Verify scan data:**
```bash
# Verify raw and filtered scan topics
ros2 topic hz /scan
ros2 topic hz /scan_filtered

# Inspect scan readings
ros2 topic echo /scan_filtered --once
```

---

### 4. IMU 9-Axis Testing & 3D RViz (WitMotion WT901)

**Run standalone IMU with live 3D orientation in RViz:**
```bash
ros2 launch ev_bringup imu.launch.py port:=/dev/ttyIMU baud:=9600 use_rviz:=true
```

**Verify data stream in terminal:**
```bash
# Check IMU topic
ros2 topic list | grep imu

# Check publishing rate (~10 - 20 Hz)
ros2 topic hz /imu/data

# Inspect live orientation, angular velocities & linear accelerations
ros2 topic echo /imu/data --once
```

---

### 5. Combined Telemetry Bringup (GPS + IMU)
When testing both GPS and IMU together:
```bash
ros2 launch ev_bringup sensors_all.launch.py gps_port:=/dev/ttyUSB0 imu_port:=/dev/ttyIMU imu_baud:=9600 use_lidar:=false use_zed:=false
```
*(If the IMU is disconnected, simply pass `use_imu:=false`)*.

---

### 6. Stereo Depth Camera Testing (Stereolabs ZED 2i)

**Ensure device permissions:**
```bash
sudo chmod 666 /dev/video*
```

**Launch Depth Camera + Kinematics + RViz:**
```bash
ros2 launch ev_bringup depth_camera.launch.py
```

**Verify live data streams:**
```bash
# Verify published topics
ros2 topic list | grep zed

# Check RGB stream frequency (15 Hz)
ros2 topic hz /zed/zed_node/rgb/color/rect/image

# Check 3D Point Cloud rate (15 Hz)
ros2 topic hz /zed/zed_node/point_cloud/cloud_registered

# Check Odometry / Visual odometry
ros2 topic echo /zed/zed_node/odom --once
```

---

### 7. Multi-Sensor Localization & EKF Fusion (Stage 5)

The `ev_localization` package provides an Extended Kalman Filter (`robot_localization`) that fuses ZED 2i visual odometry, WitMotion WT901 IMU, and Holybro M9N GNSS into a smooth, drift-resistant state estimate (`/odometry/filtered`) and continuously publishes the dynamic transform `odom -> base_link`.

The vehicle model in RViz contains complete **3D visual geometry** including the vehicle chassis, rubber wheels, roll cage structure, and realistic mounts for the RPLIDAR S3, ZED 2i stereo camera, WT901 IMU, and Holybro GPS.

#### A. Standard Bench / Desk Bringup (ZED 2i + WT901 IMU)
By default, `localization.launch.py` automatically enables the ZED 2i camera and WT901 IMU (at 9600 baud on `/dev/ttyIMU`), and keeps GPS disabled so it brings up immediately without missing hardware errors:
```bash
ros2 launch ev_localization localization.launch.py
```
*(The RViz display defaults to `Fixed Frame: base_link` for instant vehicle inspection with zero TF latency; switch to `Fixed Frame: odom` to observe world-coordinate movement).*

#### B. Full Multi-Sensor Fusion (ZED 2i + IMU + Holybro GNSS)
When testing outdoors with satellite line-of-sight:
```bash
ros2 launch ev_localization localization.launch.py \
  use_gps:=true \
  use_gps_odom:=true \
  gps_port:=/dev/ttyGPS
```

#### C. Verification & Diagnostic Commands
```bash
# 1. Verify fused odometry topic output (30 Hz)
ros2 topic hz /odometry/filtered

# 2. Inspect fused pose, velocities, and covariances
ros2 topic echo /odometry/filtered --once

# 3. Check dynamic transform (odom -> base_link) published by EKF
ros2 run tf2_ros tf2_echo odom base_link

# 4. View full TF tree
ros2 run tf2_tools view_frames
```

---

### 8. 2D Online SLAM Mapping (Stage 6)

The `mapping_slam.launch.py` in `ev_localization` runs `slam_toolbox` in online asynchronous mode, fully managed via ROS 2 lifecycle states (`configure` $\rightarrow$ `activate`):
- **LiDAR Scan:** `/scan_filtered` from RPLIDAR S3 with roll-cage pillar filtering.
- **Odometry & Vehicle Kinematics:** `/odometry/filtered` and `odom -> base_link` from `localization.launch.py` (ZED 2i VO + WT901 IMU).
- **Map Output:** Continuously updates the 2D occupancy grid `/map` (5cm resolution, 10 Hz scan rate) and broadcasts the dynamic world transform `map -> odom`.

#### A. Run 2D SLAM Bringup
```bash
# Standard bringup with all sensors connected:
ros2 launch ev_localization mapping_slam.launch.py

# If running bench test without IMU connected:
ros2 launch ev_localization mapping_slam.launch.py lidar_port:=/dev/ttyUSB0 use_imu:=false
```
*(In RViz, set **Fixed Frame** to `map` to observe the global occupancy grid build around the vehicle in real time).*

#### B. Verification & Diagnostic Commands
```bash
# 1. Check map topic publication:
ros2 topic hz /map

# 2. Inspect map metadata and dimensions:
ros2 topic echo /map --once | head -n 25

# 3. Verify complete transform chain (map -> odom -> base_link -> laser_frame):
ros2 run tf2_ros tf2_echo map odom
ros2 run tf2_ros tf2_echo map base_link

# 4. Save the built map:
ros2 run nav2_map_server map_saver_cli -f ~/my_ev_map
```

---

### 9. Telemetry Bridges, Web Command Center, & Master Launch (Stage 7)

Stage 7 introduces a zero-install, browser-based **Web Command Center** (`ev_web_dashboard`) and high-performance WebSocket/MJPEG telemetry bridges. This allows engineers and operators to monitor vehicle health, video feeds, 2D SLAM maps, 3D point clouds, and GPS position from any laptop, tablet, or smartphone connected to the vehicle's Wi-Fi network.

#### A. Network & Port Architecture
| Service | Port | Protocol | Description |
| :--- | :--- | :--- | :--- |
| **Web Command Center** | **`3000`** | HTTP | Zero-dependency static server serving the responsive dashboard UI |
| **ROS 2 Telemetry Bridge** | **`9090`** | WebSocket (ws://) | `rosbridge_websocket` streaming topics (`/map`, `/scan_filtered`, `/odometry/filtered`, `/imu/data`, `/fix`) |
| **Live Video Server** | **`8080`** | HTTP MJPEG | `web_video_server` streaming RGB camera & CUDA depth maps |

> **Dynamic Host Binding:** The dashboard automatically connects WebSocket and MJPEG streams to `window.location.hostname`. Accessing `http://192.168.1.100:3000` automatically routes data to `ws://192.168.1.100:9090` and `http://192.168.1.100:8080` without hardcoded IP configurations.

#### B. Dashboard Modules & Responsive Layouts
- **Laptop / Desktop Layout ($\ge 1024\text{px}$):**
  - **Single-Screen Command Center:** Zero-scroll 3-column layout displaying all 3 modules simultaneously.
  - **Top Status Bar:** Real-time ROS 2 connection state, vehicle forward speed (m/s & km/h), IMU yaw heading, and GNSS fix status.
  - **Module 1 (Camera & Depth):** Side-by-side or stacked RGB camera feed + CUDA depth feed at 15 FPS.
  - **Module 2 (2D SLAM & 3D Point Cloud Mapping):** Interactive 2D occupancy grid canvas (`/map` + `/scan_filtered` + robot pose arrow) alongside a Three.js WebGL 3D spatial viewport with touch/mouse orbit controls (REP-103 Z-up orientation). Features:
    - **3D Textured Occupancy Grid Floor:** Projects the live SLAM map onto a 3D floor plane in real world coordinates.
    - **3D Elevated Obstacle Wall Columns:** Transforms 2D SLAM obstacle cells into 3D holographic wall columns with height-based cyberpunk gradients.
    - **Persistent 3D LiDAR Point Cloud Mapping:** Accumulates laser scan sweeps in world coordinates as the buggy moves, creating an evolving 3D point cloud map.
    - **Stereolabs ZED 2i Registered 3D Depth Cloud:** Decodes and transforms `/zed/zed_node/point_cloud/cloud_registered` into world coordinates with RGB and depth colormaps.
    - Includes **Follow**, **Center**, **Reset**, **Clear 3D**, and **2D / 3D Layout Toggle** buttons.
  - **Module 3 (GPS Map & HUD):** Interactive Leaflet GPS map with vehicle heading cone, breadcrumb trail, artificial horizon (pitch/roll), 360° compass rose, and coordinate readouts.
- **Mobile / Tablet Layout ($< 1024\text{px}$):**
  - **Full-Screen Single Module Viewport:** Automatically adapts for one-handed operation.
  - **Bottom Thumb Navigation Bar:** Switch effortlessly between:
    1. `[Camera]` — Stacked live RGB and depth feeds.
    2. `[2D/3D Map]` — Interactive 2D SLAM grid with live laser overlay and 3D spatial view.
    3. `[GPS Map]` — Full-screen Leaflet satellite map and vehicle orientation HUD.

#### C. Master Launch Options

The system provides two tailored master launch files depending on whether you are running from a remote browser or locally on a workstation display:

##### 🌐 Option 1: Master System with Web Command Center (`system_web.launch.py`)
Brings up all sensors, kinematics, EKF localization, SLAM, and the Web Command Center. Operates headlessly by default for maximum Jetson GPU performance:
```bash
# Launch entire system with Web Command Center (:3000):
ros2 launch ev_bringup system_web.launch.py

# With custom sensor ports or bench flags:
ros2 launch ev_bringup system_web.launch.py lidar_port:=/dev/ttyUSB0 use_imu:=false use_gps:=false
```
Open **`http://<JETSON_IP>:3000`** on your laptop or phone.

---

##### 🖥️ Option 2: Master System with Dedicated RViz 2 (`system_rviz.launch.py`)
Brings up all sensors, kinematics, EKF, and SLAM, loading an all-inclusive, pre-configured RViz 2 profile (`full_system_rviz.rviz`). Zero web overhead:
```bash
# Launch entire system with comprehensive RViz 2 workspace:
ros2 launch ev_bringup system_rviz.launch.py

# With custom ports / flags:
ros2 launch ev_bringup system_rviz.launch.py lidar_port:=/dev/ttyUSB0 use_gps:=false
```

---

#### D. Modular Component & Sensor Bringup

Every component can be launched and tested individually:

```bash
# --- 1. Individual Sensor Launchers ---
ros2 launch ev_bringup lidar.launch.py serial_port:=/dev/ttyUSB0
ros2 launch ev_bringup imu.launch.py port:=/dev/ttyUSB1 baud:=9600
ros2 launch ev_bringup gps.launch.py port:=/dev/ttyUSB2 baud:=115200
ros2 launch ev_bringup depth_camera.launch.py camera_model:=zed2i
ros2 launch ev_bringup sensors_all.launch.py # Launches all 4 sensors together

# --- 2. Localization & EKF State Estimation ---
ros2 launch ev_localization localization.launch.py use_gps_odom:=true

# --- 3. 2D Online SLAM Mapping ---
ros2 launch ev_localization mapping_slam.launch.py

# --- 4. Web Video Streaming & Telemetry Bridges ---
ros2 launch ev_bringup web_video.launch.py # Ports 8080 (MJPEG) & 9090 (WebSocket)
ros2 launch ev_bringup web_dashboard.launch.py # Port 3000 (HTTP)
```

#### E. Accessing the Dashboard
Open Google Chrome, Mozilla Firefox, or Safari on any device connected to the vehicle network:
- **On the Jetson:** [http://localhost:3000](http://localhost:3000)
- **From Remote Laptop / Phone:** `http://<JETSON_IP>:3000` (e.g., `http://192.168.1.85:3000`)

---

## ⚙️ Udev Rules (Persistent Device Names)

To avoid changing port names (e.g. `/dev/ttyUSB0` vs `/dev/ttyUSB1`) and grant permanent permissions across reboots:

1. **LiDAR:**
   ```bash
   bash ~/ev_ws/src/Smart_EV_Kit_2/ev_bringup/scripts/setup_lidar.sh
   ```
2. **IMU:**
   ```bash
   bash ~/ev_ws/src/Smart_EV_Kit_2/ev_bringup/scripts/setup_imu.sh
   ```
3. **GNSS / GPS:**
   ```bash
   bash ~/ev_ws/src/Smart_EV_Kit_2/ev_bringup/scripts/setup_gps.sh
   ```

Unplug and replug the USB cables. The devices will permanently link to:
- **LiDAR:** `/dev/ttyLIDAR` (and `/dev/rplidar`)
- **GNSS:** `/dev/ttyGPS`
- **IMU:** `/dev/ttyIMU`
