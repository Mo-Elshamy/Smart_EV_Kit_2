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
  - [4. Combined Telemetry Bringup](#4-combined-telemetry-bringup)
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
│   │   ├── view_frames.launch.py            # Static vehicle frame visualizer
│   │   ├── gps.launch.py                    # Standalone Holybro M9N GNSS driver
│   │   ├── imu.launch.py                    # Standalone WitMotion WT901 IMU driver
│   │   ├── telemetry_sensors.launch.py      # Composite GPS + IMU + TF bringup
│   │   ├── lidar.launch.py                  # Standalone RPLIDAR S3 + filter
│   │   └── lidar_and_description.launch.py  # LiDAR + Roll-cage filter + Vehicle TF + RViz
│   ├── config/
│   │   ├── rviz_config.rviz                 # Default RViz view profile
│   │   └── laser_filter_params.yaml         # Angular bounds filter for roll-cage pillars
│   └── CMakeLists.txt, package.xml
└── ev_sensors/                 # Hardware driver implementations
    ├── sllidar_ros2/           # Slamtec RPLIDAR C++ driver (S3 / A-series / C-series)
    ├── nmea_navsat_driver/     # Standard NMEA serial GPS driver
    └── witmotion_ros/          # WitMotion 9-axis IMU driver
```

---

## 🔌 Hardware Interfaces & Ports Summary

| Sensor | Model | Default Port | Default Baud | Driver Package | Output Topics |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **GNSS Receiver** | Holybro M9N (FTDI) | `/dev/ttyUSB0` (or `/dev/ttyGPS`) | **`115200`** | `nmea_navsat_driver` | `/fix`, `/vel`, `/time_reference` |
| **2D LiDAR** | Slamtec RPLIDAR S3 (CP2102N) | `/dev/ttyUSB1` (or `/dev/ttyLIDAR`) | **`1000000`** | `sllidar_ros2` | `/scan`, `/scan_filtered` |
| **IMU (9-Axis)** | WitMotion WT901 | `/dev/ttyIMU` | **`115200`** | `witmotion_ros` | `/imu/data` |
| **Depth Camera** | Stereolabs ZED 2i | USB 3.0 | N/A | `zed_ros2_wrapper` | RGB, Depth, PointCloud |

---

## 🛠 System Prerequisites & Installation

### 1. Install System ROS 2 Dependencies
```bash
sudo apt update
sudo apt install -y \
  ros-$ROS_DISTRO-xacro \
  ros-$ROS_DISTRO-robot-state-publisher \
  ros-$ROS_DISTRO-joint-state-publisher \
  ros-$ROS_DISTRO-rviz2 \
  ros-$ROS_DISTRO-nmea-navsat-driver \
  ros-$ROS_DISTRO-laser-filters
```

### 2. Build the Workspace
```bash
cd ~/ev_ws
colcon build --symlink-install
source install/setup.bash
```

---

## 🔍 Changelog & Key Problem Fixes

During the initial bringup on ROS 2 Jazzy, several issues were encountered and resolved:

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
ros2 launch ev_bringup lidar_and_description.launch.py serial_port:=/dev/ttyUSB1
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

### 4. Combined Telemetry Bringup
When testing both GPS and IMU together:
```bash
ros2 launch ev_bringup telemetry_sensors.launch.py gps_port:=/dev/ttyUSB0 imu_port:=/dev/ttyUSB1
```
*(If the IMU is disconnected, simply pass `use_imu:=false`)*.

---

## ⚙️ Udev Rules (Persistent Device Names)

To avoid changing port names (e.g. `/dev/ttyUSB0` vs `/dev/ttyUSB1`) and grant permanent permissions across reboots, install the provided udev rules:

```bash
bash ~/ev_ws/src/Smart_EV_Kit_2/ev_sensors/sllidar_ros2/scripts/create_udev_rules.sh
```

Unplug and replug the USB cables. The devices will permanently link to:
- **LiDAR:** `/dev/ttyLIDAR` (and `/dev/rplidar`)
- **GNSS:** `/dev/ttyGPS`
- **IMU:** `/dev/ttyIMU`
