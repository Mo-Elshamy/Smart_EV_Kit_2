# Phase 1 Lab Instructions: Parallel Hardware Setup, Kinematics & Sensor Verification

Welcome to **Phase 1** of the Smart EV Buggy autonomy bringup. In this phase, your cohort will divide into **3 parallel engineering teams** to bring up the physical computing and perception sensors on the vehicle:

* **Team 1:** Jetson Orin Nano Platform Setup & Stereolabs ZED 2i Stereo Depth Camera
* **Team 2:** Slamtec RPLIDAR S3 2D LiDAR & Roll-Cage Filtering
* **Team 3:** WitMotion WT901 9-Axis IMU & Holybro Pixhawk M9N GNSS Receiver

Each team must physically measure their sensor's real mounting position relative to the vehicle origin (`base_link`), locate and update the respective joint origins in the robot description, download and build the hardware drivers, and verify live sensor data.

---

## 📐 Vehicle Coordinate Frame Reference (REP-105)

All physical measurements must be recorded relative to the vehicle root frame:
* **`base_link` Origin:** The geometric center of the rear axle projected down to the ground plane.
* **Axis Orientations (Right-Hand Rule):**
  * **$+X$ (Red):** Forward toward the front bumper.
  * **$+Y$ (Green):** Left toward the driver's side.
  * **$+Z$ (Blue):** Upward toward the sky.
* **Rotations:** Roll ($\phi$, about $X$), Pitch ($\theta$, about $Y$), Yaw ($\psi$, about $Z$).

---

## 🛠 Team 1: Jetson Orin Nano Setup & Stereo Depth Camera (Stereolabs ZED 2i)

### Task 1.1: Flash NVIDIA JetPack onto Jetson Orin Nano
1. Insert the provided bootable USB flash drive containing the **NVIDIA JetPack 6.x (Ubuntu 22.04 / 24.04 L4T)** installer into the Jetson Orin Nano.
2. Power on the Jetson Orin Nano while holding the Recovery button (or boot directly from the USB drive via the UEFI boot menu by pressing `ESC` / `F11` on power-on).
3. Follow the on-screen installer to complete the OS installation, configure user credentials (`user`/`password`), and establish a Wi-Fi or Ethernet connection.

### Task 1.2: Configure 8 GB Swap Space (Mandatory Memory Protection)
The Jetson Orin Nano shares its 8 GB RAM between CPU and GPU. Compiling ROS 2 C++ packages will trigger the Linux Out-Of-Memory (OOM) killer unless a swapfile is active:
```bash
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Verify 8 GB swap is active
free -h

# Make swap persistent across reboots
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Task 1.3: Install ROS 2 & System Dependencies
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
  libusb-1.0-0-dev \
  zstd git
```

### Task 1.4: Install Stereolabs ZED SDK v5.2
Download and run the ZED SDK installer for Jetson L4T:
```bash
wget -O ~/ZED_SDK_Jetson_5.2.run "https://download.stereolabs.com/zedsdk/5.2/l4t36.4/jetsons"
chmod +x ~/ZED_SDK_Jetson_5.2.run
~/ZED_SDK_Jetson_5.2.run -- silent skip_tools
```
Grant USB camera permissions:
```bash
sudo chmod 666 /dev/video*
```

### Task 1.5: Download & Build ZED ROS 2 Packages
Navigate to your workspace `src/Smart_EV_Kit_2/ev_sensors/` directory:
```bash
cd ~/ev_ws/src/Smart_EV_Kit_2/ev_sensors/

# Clone official Stereolabs ROS 2 interfaces and wrapper
git clone https://github.com/stereolabs/zed-ros2-interfaces.git
git clone https://github.com/stereolabs/zed-ros2-wrapper.git
```
Build the workspace safely using throttled compilation flags to preserve Jetson memory:
```bash
cd ~/ev_ws
source /opt/ros/$ROS_DISTRO/setup.bash
MAKEFLAGS="-j2" colcon build --symlink-install --parallel-workers 1
source install/setup.bash
```

### Task 1.6: Measure Physical Camera Position & Update URDF
1. Use a physical tape measure on the EV buggy to measure the distance from `base_link` (rear axle center on the ground) to the center of the ZED 2i camera mount:
   * Record $\Delta x$ (forward distance in meters).
   * Record $\Delta y$ (lateral offset from vehicle centerline in meters).
   * Record $\Delta z$ (height from ground in meters).
   * Record pitch/roll/yaw angle if tilted.
2. Open `ev_description/urdf/sensor_mounts.xacro`.
3. Search for the camera joint declarations (`camera_joint`, `zed_camera_joint`, and `camera_optical_joint`).
4. Replace the zeroed `<origin xyz="0.0 0.0 0.0" rpy="0.0 0.0 0.0"/>` in `camera_joint` with your measured values:
   ```xml
   <joint name="camera_joint" type="fixed">
     <parent link="base_link"/>
     <child link="camera_link"/>
     <origin xyz="YOUR_X YOUR_Y YOUR_Z" rpy="YOUR_ROLL YOUR_PITCH YOUR_YAW"/>
   </joint>
   ```
5. Note: The computer vision optical convention requires standard REP-103 optical rotation on `camera_optical_joint` (`rpy="-1.5708 0.0 -1.5708"`). Update this joint accordingly.

### Task 1.7: Camera Data Verification
```bash
source ~/ev_ws/install/setup.bash
ros2 launch ev_bringup depth_camera.launch.py
```
**Verification Checklist:**
* [ ] Verify `/zed/zed_node/rgb/color/rect/image` publishes at ~15 Hz (`ros2 topic hz /zed/zed_node/rgb/color/rect/image`).
* [ ] Verify `/zed/zed_node/point_cloud/cloud_registered` renders in RViz without transform errors.
* [ ] Verify `/zed/zed_node/odom` publishes continuous visual odometry (`ros2 topic echo /zed/zed_node/odom --once`).

---

## 🔍 Team 2: 2D Planar LiDAR (Slamtec RPLIDAR S3) & Roll-Cage Filtering

### Task 2.1: Configure Serial Permissions & Persistent Udev Rule
The Slamtec S3 communicates via a Silicon Labs CP2102N USB-UART bridge at **`1000000` baud**.
Run the automated udev installer:
```bash
cd ~/ev_ws/src/Smart_EV_Kit_2/ev_bringup/scripts/
bash setup_lidar.sh
```
Unplug and replug the LiDAR USB cable. Verify the persistent device node exists:
```bash
ls -la /dev/ttyLIDAR
```

### Task 2.2: Download & Build RPLIDAR ROS 2 Driver
Navigate to `ev_sensors/`:
```bash
cd ~/ev_ws/src/Smart_EV_Kit_2/ev_sensors/
git clone https://github.com/Slamtec/sllidar_ros2.git
```
Compile the package:
```bash
cd ~/ev_ws
source /opt/ros/$ROS_DISTRO/setup.bash
colcon build --symlink-install --packages-select sllidar_ros2
source install/setup.bash
```

### Task 2.3: Measure Physical LiDAR Position & Update URDF
1. Use a physical tape measure on the EV buggy to measure the distance from `base_link` (rear axle center on the ground) to the optical center of the RPLIDAR S3 sensor head:
   * Record $\Delta x$ (forward distance in meters).
   * Record $\Delta y$ (lateral offset in meters, 0.0 if centered).
   * Record $\Delta z$ (vertical height from ground in meters).
   * Record $(\text{roll}, \text{pitch}, \text{yaw})$ orientation.
2. Open `ev_description/urdf/sensor_mounts.xacro`.
3. Search for `laser_joint`.
4. Update the `<origin>` element with your measured values:
   ```xml
   <joint name="laser_joint" type="fixed">
     <parent link="base_link"/>
     <child link="laser_frame"/>
     <origin xyz="YOUR_X YOUR_Y YOUR_Z" rpy="YOUR_ROLL YOUR_PITCH YOUR_YAW"/>
   </joint>
   ```

### Task 2.4: LiDAR Data & Roll-Cage Filter Verification
Launch the standalone LiDAR driver with vehicle kinematics:
```bash
source ~/ev_ws/install/setup.bash
ros2 launch ev_bringup lidar_and_description.launch.py serial_port:=/dev/ttyLIDAR
```
**Verification Checklist:**
* [ ] Verify raw scan frequency: `ros2 topic hz /scan` (~10 Hz).
* [ ] Verify filtered scan frequency: `ros2 topic hz /scan_filtered` (~10 Hz).
* [ ] Check RViz: In the LaserScan display, confirm that returns hitting the vehicle roll-cage pillars are masked out by the filter chain defined in `ev_bringup/config/laser_filter_params.yaml`.

---

## 🧭 Team 3: 9-Axis IMU (WitMotion WT901) & GNSS Receiver (Holybro Pixhawk M9N)

### Task 3.1: Kernel Driver Installation & Udev Rules
1. **WitMotion WT901 (CH340 USB-UART):** Jetson Tegra kernels require the `ch341.ko` module to be installed:
   ```bash
   cd ~/ev_ws/src/Smart_EV_Kit_2/ev_bringup/scripts/
   bash setup_imu.sh
   ```
   Verify device node: `ls -la /dev/ttyIMU`.
2. **Holybro M9N GNSS (FTDI):** Install the persistent GPS udev rule:
   ```bash
   bash setup_gps.sh
   ```
   Verify device node: `ls -la /dev/ttyGPS`.

### Task 3.2: Download & Build IMU and GPS Drivers
Navigate to `ev_sensors/`:
```bash
cd ~/ev_ws/src/Smart_EV_Kit_2/ev_sensors/

# Note: witmotion_ros requires --recursive for its UART Qt submodule!
git clone --recursive https://github.com/ElettraSciComp/witmotion_ros.git
git clone -b ros2 https://github.com/ros-drivers/nmea_navsat_driver.git
```
Compile the driver packages:
```bash
cd ~/ev_ws
source /opt/ros/$ROS_DISTRO/setup.bash
colcon build --symlink-install --packages-select witmotion_ros nmea_navsat_driver
source install/setup.bash
```

### Task 3.3: Measure Physical IMU and GPS Positions & Update URDF
1. Use a physical tape measure on the EV buggy to measure the mounting locations relative to `base_link`:
   * **WT901 IMU:** Measure $(\Delta x, \Delta y, \Delta z)$ to the IMU housing mounted on the chassis spine.
   * **Holybro M9N GNSS:** Measure $(\Delta x, \Delta y, \Delta z)$ to the antenna puck atop the elevated rear mast.
2. Open `ev_description/urdf/sensor_mounts.xacro`.
3. Search for `imu_joint` and `gps_joint`.
4. Update their `<origin>` elements with your measured coordinates:
   ```xml
   <joint name="imu_joint" type="fixed">
     <parent link="base_link"/>
     <child link="imu_link"/>
     <origin xyz="YOUR_X YOUR_Y YOUR_Z" rpy="YOUR_ROLL YOUR_PITCH YOUR_YAW"/>
   </joint>

   <joint name="gps_joint" type="fixed">
     <parent link="base_link"/>
     <child link="gps_link"/>
     <origin xyz="YOUR_X YOUR_Y YOUR_Z" rpy="YOUR_ROLL YOUR_PITCH YOUR_YAW"/>
   </joint>
   ```

### Task 3.4: IMU & GNSS Data Verification
1. **Test Standalone IMU (Hardware Baud: `9600`):**
   ```bash
   source ~/ev_ws/install/setup.bash
   ros2 launch ev_bringup imu.launch.py port:=/dev/ttyIMU baud:=9600 use_rviz:=true
   ```
   * Move/tilt the sensor and verify that the 3D model tilts 1:1 in RViz.
   * Check rate: `ros2 topic hz /imu/data` (~10–20 Hz).
2. **Test Standalone GNSS (Hardware Baud: `115200`):**
   ```bash
   ros2 launch ev_bringup gps.launch.py port:=/dev/ttyGPS baud:=115200
   ```
   * Inspect coordinates: `ros2 topic echo /fix --once`.
   * Check rate: `ros2 topic hz /fix` (~1–5 Hz).
3. **Test Composite Telemetry Bringup:**
   ```bash
   ros2 launch ev_bringup telemetry_sensors.launch.py gps_port:=/dev/ttyGPS imu_port:=/dev/ttyIMU imu_baud:=9600
   ```

---

## 🏁 Phase 1 Sign-Off & Verification Checklist

Before moving to Phase 2 (Localization & Mapping), all 3 teams must verify that their coordinate frames assemble cleanly into a single transform tree:

1. Launch the vehicle frame visualizer:
   ```bash
   ros2 launch ev_bringup view_frames.launch.py
   ```
2. Generate the transform tree graph:
   ```bash
   ros2 run tf2_tools view_frames
   evince frames.pdf
   ```
3. **Verify:**
   * `base_link` connects directly to `laser_frame`, `imu_link`, `gps_link`, and `camera_link`.
   * `camera_link` connects to `zed_camera_link` and `camera_depth_optical_frame`.
   * No disconnected frames or transform islands exist.
   * All 3D visual representations are positioned accurately along the vehicle chassis in RViz.
