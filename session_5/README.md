# EV Description — Session 5: Coordinate Kinematics & TF2 Rig

This package (`ev_description`) defines the geometry-free kinematic transform tree (`tf2`) for the **Smart EV Buggy** exploration platform in **ROS 2 Jazzy**.

It establishes the spatial relationships between the vehicle's origin frame (`base_link`) and its perception and navigation sensors: 2D Planar LiDAR, Stereo Depth Camera, 9-Axis IMU, and Multi-Constellation GNSS.

## Table of Contents

 1. [System Architecture Context](#system-architecture-context)

 2. [Package Directory Layout](#package-directory-layout)

 3. [The Geometry-Free Paradigm](#the-geometry-free-paradigm)

 4. [Coordinate Frame Standards (REP-105)](#coordinate-frame-standards-rep-105)

 5. [Quickstart: Build & Launch](#quickstart-build--launch)

 6. [Lab Task: Sensor Rig Implementation](#lab-task-sensor-rig-implementation)

 7. [Sensor Coordinate Specifications](#sensor-coordinate-specifications)

 8. [Optical vs. Robotics Frames Explained](#optical-vs-robotics-frames-explained)

 9. [Validation & CLI Auditing](#validation--cli-auditing)

10. [Troubleshooting & Common Pitfalls](#troubleshooting--common-pitfalls)

## System Architecture Context

In autonomous exploration (such as cave and tunnel mapping), multi-modal sensor fusion is critical:

* **Slamtec RPLIDAR S3 (2D LiDAR):** 360° horizontal floor mapping.

* **Intel RealSense D456 (Stereo Depth):** Volumetric hazard detection (ground drop-offs and overhead obstacles).

* **WitMotion WT901 (Inertial Unit):** Angular rate, pitch, and roll attitude tracking via internal EKF.

* **Holybro Pixhawk M9N (GNSS):** Global outdoor reference coordinates prior to cave entry.

None of these sensors measure data relative to the vehicle's rotational center. They measure data relative to their own physical internal sensing elements. The `tf2` transformation tree bridges this gap by continuously broadcasting the static physical offsets of every sensor back to a common vehicle origin (`base_link`).

```
                                  map (World Frame - Fixed)
                                   │
                                   ▼ (Published by: slam_toolbox)
                                 odom (Local Odometry - Continuous)
                                   │
                                   ▼ (Published by: robot_localization EKF)
                               base_link (Center of Rear Axle, Ground Plane)
                                   │
         ┌─────────────────────────┼─────────────────────────┬─────────────────────────┐
         │ (Static via URDF)       │ (Static via URDF)       │ (Static via URDF)       │ (Static via URDF)
         ▼                         ▼                         ▼                         ▼
    laser_frame               camera_link                 imu_link                  gps_link
 (Slamtec S3 LiDAR)      (Intel RealSense D456)      (WitMotion WT901)         (Holybro M9N GNSS)
                                   │
                                   ▼ (Static via URDF)
                       camera_depth_optical_frame

```

## Package Directory Layout

```
ev_description/
├── CMakeLists.txt                # Build configuration and install targets
├── package.xml                   # Package dependencies and metadata
├── README.md                     # Lab guide and kinematic specifications
├── launch/
│   └── view_frames.launch.py     # Starts robot_state_publisher and RViz 2
├── rviz/
│   └── tf_view.rviz              # Pre-configured RViz 2 display profile
└── urdf/
    ├── ev_buggy.urdf.xacro       # Root assembly (defines base_link origin)
    └── sensor_mounts.urdf.xacro  # Student lab file: rigid sensor joints

```

## The Geometry-Free Paradigm

This package **does not include 3D CAD meshes, wheels, or chassis visual bodies**.

In production robotics stacks, algorithms for SLAM (`slam_toolbox`), State Estimation (`robot_localization`), and point cloud projection do not require visual styling; they require precise **spatial translation vectors (**$X, Y, Z$**) and rotational attitudes (Roll, Pitch, Yaw)**.

Each sensor link functions as an exact mathematical coordinate frame represented in RViz 2 by a coordinate tripod:

* **Red Axis:** $+X$ (Forward)

* **Green Axis:** $+Y$ (Left)

* **Blue Axis:** $+Z$ (Upward)

## Coordinate Frame Standards (REP-105)

ROS conforms to **REP-105** and the **Right-Hand Rule**:

* $X$**-axis (Forward):** Pointing towards the front of the buggy.

* $Y$**-axis (Left):** Pointing towards the driver's left-hand side.

* $Z$**-axis (Up):** Pointing straight up towards the sky.

* **Rotations:**

  * **Roll (**$\phi$**):** Rotation about the $X$-axis (tilting left/right).

  * **Pitch (**$\theta$**):** Rotation about the $Y$-axis (pitching nose up/down).

  * **Yaw (**$\psi$**):** Rotation about the $Z$-axis (steering/heading change).

* **Units:** All linear dimensions are in **meters** ($\text{m}$); all angular rotations are in **radians** ($\text{rad}$).

The vehicle origin (`base_link`) is defined per REP-105 at the **center of the rear axle, projected down to the ground plane**.

## Quickstart: Build & Launch

### 1. Ensure Package is in Workspace Source Tree

```
# Verify directory structure
ls ~/ev_ws/src/ev_description

```

### 2. Build the Workspace

Always use `--symlink-install` so that edits to `.xacro` and launch files take effect immediately without requiring full rebuilds:

```
cd ~/ev_ws
colcon build --symlink-install
source install/setup.bash

```

### 3. Launch the Coordinate Visualizer

```
ros2 launch ev_description view_frames.launch.py

```

*RViz 2 will open automatically with the grid and coordinate tripods pre-loaded.*

## Lab Task: Sensor Rig Implementation

Open `urdf/sensor_mounts.urdf.xacro` in your text editor (VS Code, Nano, or Gedit):

```
nano ~/ev_ws/src/ev_description/urdf/sensor_mounts.urdf.xacro

```

You are provided with a working reference joint for the **LiDAR** (`laser_frame`):

```
  <!-- REFERENCE TEMPLATE: Slamtec RPLIDAR S3 -->
  <link name="laser_frame"/>

  <joint name="laser_joint" type="fixed">
    <parent link="base_link"/>
    <child link="laser_frame"/>
    <origin xyz="1.2 0.0 0.45" rpy="0.0 0.0 0.0"/>
  </joint>

```

### Your Objective:

Duplicate and adapt this block to add the remaining four vehicle coordinate frames:

1. `imu_link` (WitMotion WT901)

2. `gps_link` (Holybro M9N GNSS)

3. `camera_link` (Intel RealSense D456 Chassis Body)

4. `camera_depth_optical_frame` (RealSense Optical Focal Axis — **Nested under `camera_link`**)

## Sensor Coordinate Specifications

Derive your `<origin xyz="..." rpy="..."/>` tags using the physical hardware mounting locations on the buggy chassis:

| 

| **Target Frame (<child>)** | **Sensor Hardware** | **Parent Frame (<parent>)** | **Translation: X,Y,Z (m)** | **Rotation: R,P,Y (rad)** | **Physical Location** | 
| `laser_frame` | Slamtec RPLIDAR S3 | `base_link` | `1.20,  0.00, 0.45` | `0.0, 0.0, 0.0` | Overhead roll arch center plate | 
| `imu_link` | WitMotion WT901 | `base_link` | `0.40,  0.00, 0.25` | `0.0, 0.0, 0.0` | Center spine near Center of Gravity | 
| `gps_link` | Holybro M9N GNSS | `base_link` | `0.10,  0.00, 1.10` | `0.0, 0.0, 0.0` | Elevated rear fiberglass mast | 
| `camera_link` | RealSense D456 (Body) | `base_link` | `1.25,  0.00, 0.35` | `0.0, 0.0, 0.0` | Front impact cowl bracket | 
| `camera_depth_optical_frame` | RealSense Optical Axis | **`camera_link`** | `0.00,  0.00, 0.00` | `-1.5708, 0.0, -1.5708` | Internal sensor focal plane | 

## Optical vs. Robotics Frames Explained

Notice that `camera_depth_optical_frame` has a non-zero rotation: `rpy="-1.5708 0.0 -1.5708"`.

* **Standard Robotics Frame (`camera_link`):**

  * $+X =$ Forward

  * $+Y =$ Left

  * $+Z =$ Up

* **Standard Computer Vision / Optical Frame (`camera_depth_optical_frame`):**

  * $+Z =$ Forward (along camera optical view axis)

  * $+X =$ Right (across sensor array columns)

  * $+Y =$ Down (along sensor array rows)

To rotate the standard robotics frame into the optical frame:

1. Roll $-90^\circ$ ($-1.5708\text{ rad}$) around $X$.

2. Yaw $-90^\circ$ ($-1.5708\text{ rad}$) around $Z$.

```
   Robotics Frame (camera_link)            Optical Frame (camera_depth_optical_frame)
              +Z (Up)                                   +Y (Down)
                │                                          │
                │                                          │
                └───► +X (Forward)                         └───► +Z (Forward View)
               /                                          /
              ▼                                          ▼
            +Y (Left)                                  +X (Right)

```

*Failure to include this rotation will cause point clouds and depth images to display upside down or sideways in RViz.*

## Validation & CLI Auditing

Never rely solely on visual inspection. Certify your transform tree quantitatively using the ROS 2 command line.

### 1. Numerical Transform Echo

Open a second terminal, source the workspace, and query specific frame relationships:

```
# Check LiDAR position relative to buggy origin
ros2 run tf2_ros tf2_echo base_link laser_frame

```

*Expected Output:*

```
At time ...
- Translation: [1.200, 0.000, 0.450]
- Rotation: in Quaternion [0.0, 0.0, 0.0, 1.0]

```

```
# Check optical frame nesting under camera_link
ros2 run tf2_ros tf2_echo camera_link camera_depth_optical_frame

```

*Expected Output:*

```
At time ...
- Translation: [0.000, 0.000, 0.000]
- Rotation: in Quaternion [-0.500, 0.500, -0.500, 0.500]

```

### 2. Export and Audit the Transform Graph

Generate a visual PDF of the active kinematic tree:

```
cd ~/ev_ws
ros2 run tf2_tools view_frames

```

This produces `frames.pdf`. Open it:

```
evince frames.pdf

```

**Certification Criteria:**

* `base_link` must be the root node.

* Every frame (`laser_frame`, `imu_link`, `gps_link`, `camera_link`) must branch directly from `base_link`.

* `camera_depth_optical_frame` must branch directly from `camera_link`.

* There must be **zero disconnected frame islands**.

## Troubleshooting & Common Pitfalls

| **Symptom** | **Root Cause** | **Fix** | 
| **`XML parsing error: duplicate joint name`** | Copied `<joint name="laser_joint">` without renaming it for the other sensors. | Give each joint a unique name: `imu_joint`, `gps_joint`, `camera_joint`. | 
| **`No transform from [frame] to [base_link]` in RViz** | Mismatched frame names between `<child link="..."/>` and `<link name="..."/>`, or misspelled parent name. | Ensure string names match exactly (case-sensitive). | 
| **`camera_depth_optical_frame` is detached in `frames.pdf`** | Set parent link to an invalid string or left joint definition unclosed. | Confirm `<parent link="camera_link"/>` and check closing `</joint>` tag. | 
| **Changes to Xacro file not showing up in RViz** | Did not build with `--symlink-install` or forgot to source environment. | Run `colcon build --symlink-install && source install/setup.bash`. | 
| **RViz screen shows complete black / empty grid** | Fixed Frame in RViz is set to a non-existent link. | Set **Fixed Frame** at the top of RViz Displays panel to `base_link`. | 

## Deliverable Checklist

* \[ \] `sensor_mounts.urdf.xacro` contains all 5 defined frames.

* \[ \] Workspace compiles cleanly with `colcon build --symlink-install`.

* \[ \] RViz 2 visualizes 5 distinct tripods positioned correctly around `base_link`.

* \[ \] `camera_depth_optical_frame` correctly displays $Z$ pointing forward.

* \[ \] `frames.pdf` generated and verified with zero broken transforms.

* \[ \] Feature branch committed and pushed to squad repository:

  ```
  git add urdf/sensor_mounts.urdf.xacro
  git commit -m "feat(description): configure complete 5-zone sensor rig kinematic tree"
  git push origin squad-kinematics
  
  ```
