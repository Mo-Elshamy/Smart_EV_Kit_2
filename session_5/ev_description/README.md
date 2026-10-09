# EV Description - Session 5

This folder contains the ROS 2 package used for the Smart EV frame-definition exercise.

## Package layout

```text
session_5/
└── ev_description/
    ├── CMakeLists.txt
    ├── README.md
    ├── package.xml
    ├── launch/
    │   └── view_frames.launch.py
    └── urdf/
        ├── ev_buggy.urdf.xacro
        └── sensor_mounts.urdf.xacro
```

## Exercise goal

Build a minimal `ament_cmake` package that defines the Smart EV buggy reference frames and publishes them through `robot_state_publisher` so students can inspect the TF tree in RViz.

## Quickstart

1. Place this folder in your ROS 2 workspace under `src/`.
2. Build the workspace:

```bash
cd ~/ev_ws
colcon build --symlink-install
source install/setup.bash
```

3. Launch the frame viewer:

```bash
ros2 launch ev_description view_frames.launch.py
```

4. In a second terminal, check the frame graph:

```bash
ros2 run tf2_tools view_frames
```

5. Open RViz and verify the `base_link` frame and the connected sensor links are visible.

## Lab task

Edit `urdf/sensor_mounts.urdf.xacro` and extend the reference model by adding the remaining frames:

- IMU: `imu_link` -> parent `base_link`
- GNSS: `gps_link` -> parent `base_link`
- Camera: `camera_link` -> parent `base_link`
- Optical frame: `camera_depth_optical_frame` -> parent `camera_link`

Use the LiDAR example as the template for the fixed joint definitions.

## Notes

- The package intentionally keeps the robot model geometry-free.
- Only links and fixed joints are defined to focus on the kinematic tree.
- This session is designed to emphasize coordinate frame hierarchy and TF publication.
