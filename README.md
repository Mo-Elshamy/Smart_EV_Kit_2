# Smart EV Kit 2 — Autonomous EV Sensor Rig & Bringup

Upgraded Smart EV sensor rig with kinematics, transform pipelines, hardware drivers, multi-sensor localization, and 2D SLAM mapping for ROS 2 (Jazzy / Humble).

---

## 📋 Table of Contents
- [Architecture & Package Structure](#architecture--package-structure)
- [Hardware Interfaces & Ports Summary](#hardware-interfaces--ports-summary)
- [System Prerequisites & Installation](#system-prerequisites--installation)
- [Running & Testing the System](#running--testing-the-system)
  - [1. Kinematic TF2 Frames & RViz](#1-kinematic-tf2-frames--rviz)
  - [2. GNSS / GPS Testing (Holybro M9N)](#2-gnss--gps-testing-holybro-m9n)
  - [3. 2D LiDAR Testing (Slamtec RPLIDAR S3)](#3-2d-lidar-testing-slamtec-rplidar-s3)
  - [4. IMU 9-Axis Testing & 3D RViz (WitMotion WT901)](#4-imu-9-axis-testing--3d-rviz-witmotion-wt901)
  - [5. Combined Telemetry Bringup (GPS + IMU)](#5-combined-telemetry-bringup-gps--imu)
  - [6. Stereo Depth Camera Testing (Stereolabs ZED 2i)](#6-stereo-depth-camera-testing-stereolabs-zed-2i)
  - [7. Multi-Sensor Localization & EKF Fusion](#7-multi-sensor-localization--ekf-fusion)
  - [8. 2D Online SLAM Mapping](#8-2d-online-slam-mapping)
- [Udev Rules (Persistent Device Names)](#udev-rules-persistent-device-names)

---

## 🏗 Architecture & Package Structure

```text
src/Smart_EV_Kit_2/
├── ev_description/             # Kinematic tree (URDF/xacro) & coordinate frames
│   ├── urdf/
│   │   ├── ev_buggy.urdf.xacro # Base robot root (base_link), chassis, and wheels
│   │   └── sensor_mounts.xacro # Transforms for LiDAR, IMU, GPS, and ZED Camera
│   └── CMakeLists.txt, package.xml
├── ev_bringup/                 # Launch files, configurations, RViz profiles
│   ├── launch/
│   │   ├── view_frames.launch.py            # Static vehicle frame visualizer
│   │   ├── gps.launch.py                    # Standalone Holybro M9N GNSS driver
│   │   ├── imu.launch.py                    # Standalone WitMotion WT901 IMU + 3D RViz
│   │   ├── telemetry_sensors.launch.py      # Composite GPS + IMU + TF bringup
│   │   ├── lidar.launch.py                  # Standalone RPLIDAR S3 + filter
│   │   ├── lidar_and_description.launch.py  # LiDAR + Roll-cage filter + Vehicle TF + RViz
│   │   └── depth_camera.launch.py           # ZED 2i Stereo Depth + RGB + PointCloud + RViz
│   ├── config/
│   │   ├── rviz_config.rviz                 # RViz profile with PointCloud, Scans, and Video
│   │   ├── rviz_imu.rviz                    # Dedicated 3D orientation visualizer profile
│   │   ├── laser_filter_params.yaml         # Angular bounds filter for roll-cage pillars
│   │   └── zed2i_params.yaml                # ZED 2i camera and CUDA depth tuning overrides
│   ├── scripts/
│   │   ├── imu_tf_broadcaster.py            # Dynamic 3D TF orientation broadcaster for RViz
│   │   ├── setup_imu.sh                     # Automated CH340 kernel module & udev installer
│   │   ├── setup_gps.sh                     # Persistent FTDI udev rule installer for Holybro M9N
│   │   └── setup_lidar.sh                   # Persistent CP2102 udev rule installer for Slamtec S3
│   └── CMakeLists.txt, package.xml
├── ev_localization/            # Sensor fusion & SLAM state estimation
│   ├── launch/
│   │   ├── localization.launch.py       # EKF + NavSat + State Publisher + RViz
│   │   └── mapping_slam.launch.py       # Online async SLAM Toolbox + EKF + Scan
│   ├── config/
│   │   ├── ekf_fusion_params.yaml       # robot_localization EKF (ZED + IMU + GPS) config
│   │   └── slam_toolbox_params.yaml     # slam_toolbox 2D mapping parameters
│   └── CMakeLists.txt, package.xml
└── ev_sensors/                 # Hardware driver workspaces
    └── .gitkeep                 # Cloned upstream drivers (sllidar, witmotion, nmea, zed)
```

---

## 🔌 Hardware Interfaces & Ports Summary

| Sensor | Model | Default Port | Default Baud | Driver Package | Output Topics |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GNSS Receiver** | Holybro M9N (FTDI) | `/dev/ttyGPS` (or `/dev/ttyUSB0`) | **`115200`** | `nmea_navsat_driver` | `/fix`, `/vel`, `/time_reference` |
| **2D LiDAR** | Slamtec RPLIDAR S3 (CP2102N) | `/dev/ttyLIDAR` (or `/dev/ttyUSB1`) | **`1000000`** | `sllidar_ros2` | `/scan`, `/scan_filtered` |
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
  ros-$ROS_DISTRO-laser-filters \
  ros-$ROS_DISTRO-robot-localization \
  ros-$ROS_DISTRO-slam-toolbox \
  ros-$ROS_DISTRO-nav2-map-server \
  cuda-toolkit-13-2 \
  libusb-1.0-0-dev \
  zstd git
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

### 4. Build the Workspace Safely
Always compile with throttled parallel jobs (`-j2` and `--parallel-workers 1`) to keep RAM usage within limits on the Jetson:
```bash
cd ~/ev_ws
source /opt/ros/$ROS_DISTRO/setup.bash
MAKEFLAGS="-j2" colcon build --symlink-install --parallel-workers 1
source install/setup.bash
```

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
ros2 launch ev_bringup gps.launch.py port:=/dev/ttyGPS baud:=115200
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
**Run standalone LiDAR + Roll-cage filter:**
```bash
ros2 launch ev_bringup lidar.launch.py serial_port:=/dev/ttyLIDAR
```

**Run LiDAR + Vehicle Kinematics + RViz:**
```bash
ros2 launch ev_bringup lidar_and_description.launch.py serial_port:=/dev/ttyLIDAR
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
ros2 launch ev_bringup telemetry_sensors.launch.py gps_port:=/dev/ttyGPS imu_port:=/dev/ttyIMU imu_baud:=9600
```

---

### 6. Stereo Depth Camera Testing (Stereolabs ZED 2i)
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

### 7. Multi-Sensor Localization & EKF Fusion

The `ev_localization` package provides an Extended Kalman Filter (`robot_localization`) that fuses ZED 2i visual odometry, WitMotion WT901 IMU, and Holybro M9N GNSS into a smooth state estimate (`/odometry/filtered`) and continuously publishes the dynamic transform `odom -> base_link`.

#### A. Standard Bench / Desk Bringup (ZED 2i + WT901 IMU)
By default, `localization.launch.py` automatically enables the ZED 2i camera and WT901 IMU (at 9600 baud on `/dev/ttyIMU`), and keeps GPS disabled for indoor operation:
```bash
ros2 launch ev_localization localization.launch.py
```

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

### 8. 2D Online SLAM Mapping

The `mapping_slam.launch.py` in `ev_localization` runs `slam_toolbox` in online asynchronous mode:
- **LiDAR Scan:** `/scan_filtered` from RPLIDAR S3 with roll-cage pillar filtering.
- **Odometry & Vehicle Kinematics:** `/odometry/filtered` and `odom -> base_link` from `localization.launch.py` (ZED 2i VO + WT901 IMU).
- **Map Output:** Continuously updates the 2D occupancy grid `/map` (5cm resolution, 10 Hz scan rate) and broadcasts the dynamic world transform `map -> odom`.

#### A. Run 2D SLAM Bringup
```bash
# Standard bringup with all sensors connected:
ros2 launch ev_localization mapping_slam.launch.py

# If running bench test without IMU connected:
ros2 launch ev_localization mapping_slam.launch.py lidar_port:=/dev/ttyLIDAR use_imu:=false
```

#### B. Verification & Saving the Map
```bash
# 1. Check map topic publication:
ros2 topic hz /map

# 2. Verify complete transform chain (map -> odom -> base_link -> laser_frame):
ros2 run tf2_ros tf2_echo map odom
ros2 run tf2_ros tf2_echo map base_link

# 3. Save the built map:
ros2 run nav2_map_server map_saver_cli -f ~/my_ev_map
```

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
- **LiDAR:** `/dev/ttyLIDAR`
- **GNSS:** `/dev/ttyGPS`
- **IMU:** `/dev/ttyIMU`
