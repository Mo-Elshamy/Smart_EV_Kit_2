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
* **Rotations (Radians):** Roll ($\phi$, about $X$), Pitch ($\theta$, about $Y$), Yaw ($\psi$, about $Z$).

---

## 🛠 Team 1: Jetson Orin Nano Setup & Stereo Depth Camera (Stereolabs ZED 2i)

### Task 1.1: Flash NVIDIA JetPack onto Jetson Orin Nano
1. Insert the provided bootable USB flash drive containing the **NVIDIA JetPack 6.x (Ubuntu 24.04 / 22.04 L4T)** image into the Jetson Orin Nano.
2. Power on the Jetson Orin Nano and boot from the USB drive via the UEFI boot menu (press `ESC` or `F11` at the NVIDIA boot screen).
3. Follow the on-screen OEM setup wizard to configure user credentials, timezone, and Wi-Fi / Ethernet network connectivity.

### Task 1.2: Configure 8 GB Swap Space (Mandatory Memory Protection)
The Jetson Orin Nano shares its 8 GB RAM between the CPU and GPU. Compiling C++ ROS 2 packages will trigger the Linux Out-Of-Memory (OOM) killer unless an 8 GB swapfile is active:
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

### Task 1.3: Install ROS 2 Jazzy & Build Tools on the Fresh Jetson
If ROS 2 is not yet installed on the freshly flashed JetPack OS, install it:
```bash
# 1. Configure UTF-8 Locale
sudo apt update && sudo apt install -y locales software-properties-common curl git
sudo locale-gen en_US en_US.UTF-8
sudo update-locale LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8
export LANG=en_US.UTF-8

# 2. Enable Ubuntu Universe & ROS 2 APT Repository
sudo add-apt-repository universe -y
sudo curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key -o /usr/share/keyrings/ros-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(. /etc/os-release && echo $UBUNTU_CODENAME) main" | sudo tee /etc/apt/sources.list.d/ros2.list > /dev/null

# 3. Install ROS 2 Desktop & Dev Tools (colcon, rosdep)
sudo apt update
sudo apt install -y ros-dev-tools ros-jazzy-desktop

# 4. Initialize rosdep and source ROS 2 automatically
sudo rosdep init || true
rosdep update
echo "source /opt/ros/jazzy/setup.bash" >> ~/.bashrc
source ~/.bashrc
```

### Task 1.4: Install System, CUDA & ROS 2 Package Dependencies
Install all required ROS 2 packages, Qt5 serial libraries, and CUDA dependencies:
```bash
sudo apt update
sudo apt install -y \
  ros-$ROS_DISTRO-xacro \
  ros-$ROS_DISTRO-robot-state-publisher \
  ros-$ROS_DISTRO-joint-state-publisher \
  ros-$ROS_DISTRO-rviz2 \
  ros-$ROS_DISTRO-tf2-tools \
  ros-$ROS_DISTRO-tf2-geometry-msgs \
  ros-$ROS_DISTRO-laser-filters \
  ros-$ROS_DISTRO-robot-localization \
  ros-$ROS_DISTRO-slam-toolbox \
  ros-$ROS_DISTRO-nav2-map-server \
  ros-$ROS_DISTRO-nmea-msgs \
  ros-$ROS_DISTRO-geographic-msgs \
  ros-$ROS_DISTRO-diagnostic-updater \
  ros-$ROS_DISTRO-backward-ros \
  ros-$ROS_DISTRO-zed-description \
  ros-$ROS_DISTRO-image-transport-plugins \
  ros-$ROS_DISTRO-compressed-image-transport \
  ros-$ROS_DISTRO-compressed-depth-image-transport \
  ros-$ROS_DISTRO-theora-image-transport \
  ros-$ROS_DISTRO-zstd-image-transport \
  cuda-toolkit-13-2 \
  qtbase5-dev \
  libqt5serialport5-dev \
  nlohmann-json3-dev \
  python3-serial \
  python3-numpy \
  libusb-1.0-0-dev \
  zstd evince
```

### Task 1.5: Install Stereolabs ZED SDK v5.2
Download and run the ZED SDK installer for Jetson L4T:
```bash
wget -O ~/ZED_SDK_Jetson_5.2.run "https://download.stereolabs.com/zedsdk/5.2/l4t36.4/jetsons"
chmod +x ~/ZED_SDK_Jetson_5.2.run
~/ZED_SDK_Jetson_5.2.run -- silent skip_tools
```
Grant USB video permissions:
```bash
sudo chmod 666 /dev/video*
```

### Task 1.6: Create Workspace, Clone Repository & Download ZED ROS 2 Packages
1. Create the workspace and clone the `ev_ws` branch of `Smart_EV_Kit_2`:
   ```bash
   mkdir -p ~/ev_ws/src
   cd ~/ev_ws/src
   git clone -b ev_ws https://github.com/Mo-Elshamy/Smart_EV_Kit_2.git
   ```
2. Navigate to `ev_sensors/` and clone the official Stereolabs ROS 2 driver repositories:
   ```bash
   cd ~/ev_ws/src/Smart_EV_Kit_2/ev_sensors/
   git clone https://github.com/stereolabs/zed-ros2-interfaces.git
   git clone https://github.com/stereolabs/zed-ros2-wrapper.git
   ```
3. Resolve any remaining package dependencies with `rosdep` and build the workspace using throttled compilation flags:
   ```bash
   cd ~/ev_ws
   source /opt/ros/$ROS_DISTRO/setup.bash
   rosdep install --from-paths src --ignore-src -r -y
   MAKEFLAGS="-j2" colcon build --symlink-install --parallel-workers 1
   source install/setup.bash
   ```

### Task 1.7: Measure Physical Camera Position & Update URDF
1. Use a physical tape measure on the EV buggy to measure the distance from `base_link` (rear axle center on the ground) to the center of the ZED 2i camera mount:
   * Record $\Delta x$ (forward distance in meters).
   * Record $\Delta y$ (lateral offset from vehicle centerline in meters).
   * Record $\Delta z$ (height from ground in meters).
   * Record $(\text{roll}, \text{pitch}, \text{yaw})$ orientation in radians.
2. Open `ev_description/urdf/sensor_mounts.xacro`.
3. Search the file to locate the camera joints (`camera_joint`, `zed_camera_joint`, and `camera_optical_joint`).
4. Replace the zeroed `<origin>` values with your measured coordinates (and configure the standard REP-103 computer vision optical frame rotation `rpy="-1.5708 0.0 -1.5708"` on `camera_optical_joint`).

### Task 1.8: Camera Data Verification
```bash
source ~/ev_ws/install/setup.bash
ros2 launch ev_bringup depth_camera.launch.py
```
**Verification Checklist:**
* [ ] Verify `/zed/zed_node/rgb/color/rect/image` publishes at ~15 Hz (`ros2 topic hz /zed/zed_node/rgb/color/rect/image`).
* [ ] Verify `/zed/zed_node/image/depth_image` and `/zed/zed_node/point_cloud/cloud_registered` render in RViz without transform errors.
* [ ] Verify `/zed/zed_node/odom` publishes continuous visual odometry (`ros2 topic echo /zed/zed_node/odom --once`).

---

## 🔍 Team 2: 2D Planar LiDAR (Slamtec RPLIDAR S3) & Roll-Cage Filtering

### Task 2.1: Clone Repository & Install Dependencies
If working on a separate workstation before merging onto the Jetson, create your workspace and install the required packages:
```bash
sudo apt update
sudo apt install -y \
  ros-$ROS_DISTRO-xacro \
  ros-$ROS_DISTRO-robot-state-publisher \
  ros-$ROS_DISTRO-rviz2 \
  ros-$ROS_DISTRO-tf2-tools \
  ros-$ROS_DISTRO-laser-filters \
  evince

mkdir -p ~/ev_ws/src
cd ~/ev_ws/src
git clone -b ev_ws https://github.com/Mo-Elshamy/Smart_EV_Kit_2.git
```

### Task 2.2: Configure Serial Permissions & Persistent Udev Rule
The Slamtec S3 communicates via a Silicon Labs CP2102N USB-UART bridge at **`1000000` baud**.
Run the automated udev installer:
```bash
cd ~/ev_ws/src/Smart_EV_Kit_2/ev_bringup/scripts/
bash setup_lidar.sh
```
Unplug and replug the LiDAR USB cable. Verify the persistent device symlink exists:
```bash
ls -la /dev/ttyLIDAR
```

### Task 2.3: Download & Build RPLIDAR ROS 2 Driver
Navigate to `ev_sensors/` and clone the Slamtec ROS 2 driver:
```bash
cd ~/ev_ws/src/Smart_EV_Kit_2/ev_sensors/
git clone https://github.com/Slamtec/sllidar_ros2.git
```
Compile the packages:
```bash
cd ~/ev_ws
source /opt/ros/$ROS_DISTRO/setup.bash
colcon build --symlink-install --packages-select ev_description ev_bringup sllidar_ros2
source install/setup.bash
```

### Task 2.4: Measure Physical LiDAR Position & Update URDF
1. Use a physical tape measure on the EV buggy to measure the distance from `base_link` (rear axle center on the ground) to the optical center of the RPLIDAR S3 sensor head:
   * Record $\Delta x$ (forward distance in meters).
   * Record $\Delta y$ (lateral offset in meters).
   * Record $\Delta z$ (vertical height from ground in meters).
   * Record $(\text{roll}, \text{pitch}, \text{yaw})$ orientation in radians.
2. Open `ev_description/urdf/sensor_mounts.xacro`.
3. Search the file for the LiDAR joint definition and update its `<origin>` element with your measured values.

### Task 2.5: LiDAR Data & Roll-Cage Filter Verification
Launch the LiDAR driver with vehicle kinematics and RViz:
```bash
source ~/ev_ws/install/setup.bash
ros2 launch ev_bringup lidar_and_description.launch.py serial_port:=/dev/ttyLIDAR
```
**Verification Checklist:**
* [ ] Verify raw scan frequency: `ros2 topic hz /scan` (~10 Hz).
* [ ] Verify filtered scan frequency: `ros2 topic hz /scan_filtered` (~10 Hz).
* [ ] Inspect `/scan_filtered` in RViz and confirm that laser returns hitting the vehicle roll-cage pillars are masked out by `ev_bringup/config/laser_filter_params.yaml`.

---

## 🧭 Team 3: 9-Axis IMU (WitMotion WT901) & GNSS Receiver (Holybro Pixhawk M9N)

### Task 3.1: Clone Repository & Install Build Dependencies
`witmotion_ros` requires Qt5 serial port development headers (`qtbase5-dev` and `libqt5serialport5-dev`), and `nmea_navsat_driver` requires `nmea_msgs` and `python3-serial`:
```bash
sudo apt update
sudo apt install -y \
  ros-$ROS_DISTRO-xacro \
  ros-$ROS_DISTRO-robot-state-publisher \
  ros-$ROS_DISTRO-rviz2 \
  ros-$ROS_DISTRO-tf2-tools \
  ros-$ROS_DISTRO-tf2-geometry-msgs \
  ros-$ROS_DISTRO-nmea-msgs \
  qtbase5-dev \
  libqt5serialport5-dev \
  python3-serial \
  python3-numpy \
  build-essential curl evince

mkdir -p ~/ev_ws/src
cd ~/ev_ws/src
git clone -b ev_ws https://github.com/Mo-Elshamy/Smart_EV_Kit_2.git
```

### Task 3.2: Kernel Driver Installation & Udev Rules
1. **WitMotion WT901 (CH340 USB-UART):** Stock Jetson Tegra kernels disable the CH341 driver by default. Run `setup_imu.sh` to automatically build/load `ch341.ko` and create the `/dev/ttyIMU` udev rule:
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

### Task 3.3: Download & Build IMU and GPS Drivers
Navigate to `ev_sensors/` and clone both driver repositories:
```bash
cd ~/ev_ws/src/Smart_EV_Kit_2/ev_sensors/

# IMPORTANT: witmotion_ros requires --recursive to pull its witmotion-uart-qt submodule!
git clone --recursive https://github.com/ElettraSciComp/witmotion_ros.git
git clone -b ros2 https://github.com/ros-drivers/nmea_navsat_driver.git
```
Compile the packages:
```bash
cd ~/ev_ws
source /opt/ros/$ROS_DISTRO/setup.bash
rosdep install --from-paths src --ignore-src -r -y
colcon build --symlink-install --packages-select ev_description ev_bringup witmotion_ros nmea_navsat_driver
source install/setup.bash
```

### Task 3.4: Measure Physical IMU and GPS Positions & Update URDF
1. Use a physical tape measure on the EV buggy to measure the mounting locations relative to `base_link`:
   * **WT901 IMU:** Measure $(\Delta x, \Delta y, \Delta z)$ to the IMU enclosure mounted on the chassis center spine.
   * **Holybro M9N GNSS:** Measure $(\Delta x, \Delta y, \Delta z)$ to the GPS dome antenna atop the elevated rear mast.
2. Open `ev_description/urdf/sensor_mounts.xacro`.
3. Search the file for the IMU and GPS joint definitions and update their `<origin>` elements with your measured coordinates.

### Task 3.5: IMU & GNSS Data Verification
1. **Test Standalone IMU (Hardware Baud: `9600`):**
   ```bash
   source ~/ev_ws/install/setup.bash
   ros2 launch ev_bringup imu.launch.py port:=/dev/ttyIMU baud:=9600 use_rviz:=true
   ```
   * Tilt/rotate the IMU and confirm live 3D orientation movement in RViz.
   * Check rate: `ros2 topic hz /imu/data` (~10–20 Hz).
   * Inspect message: `ros2 topic echo /imu/data --once`.
2. **Test Standalone GNSS (Hardware Baud: `115200`):**
   ```bash
   ros2 launch ev_bringup gps.launch.py port:=/dev/ttyGPS baud:=115200
   ```
   * Inspect coordinates: `ros2 topic echo /fix --once`.
   * Check rate: `ros2 topic hz /fix` (~1–5 Hz).
3. **Test Combined Telemetry Bringup:**
   ```bash
   ros2 launch ev_bringup telemetry_sensors.launch.py gps_port:=/dev/ttyGPS imu_port:=/dev/ttyIMU imu_baud:=9600
   ```

---

## 🏁 Phase 1 Sign-Off & Integration Checklist

Once all 3 teams have verified their individual sensors, combine all cloned driver packages in `ev_sensors/` and all measured joint origins in `ev_description/urdf/sensor_mounts.xacro` on the **Jetson Orin Nano**:

1. Rebuild the complete workspace on the Jetson Orin Nano:
   ```bash
   cd ~/ev_ws
   MAKEFLAGS="-j2" colcon build --symlink-install --parallel-workers 1
   source install/setup.bash
   ```
2. Launch the static vehicle frame visualizer:
   ```bash
   ros2 launch ev_bringup view_frames.launch.py
   ```
3. Generate and inspect the complete transform tree PDF:
   ```bash
   ros2 run tf2_tools view_frames
   evince frames.pdf
   ```
4. **Confirm before completing Phase 1:**
   * [ ] `base_link` branches directly to `laser_frame`, `imu_link`, `gps_link`, and `camera_link`.
   * [ ] `camera_link` branches to `zed_camera_link` and `camera_depth_optical_frame`.
   * [ ] Every sensor visual model sits at its real measured position on the EV buggy in RViz.
   * [ ] All 4 hardware sensor streams (`/scan_filtered`, `/imu/data`, `/fix`, `/zed/zed_node/odom`) are verified and operational.
