# Instructor Guide: tb3_sensor_lab Repo Structure

**Verify first.** This layout is based on the Jazzy `turtlebot3_gazebo` package from memory. Check every file and topic name against your installed version before writing the repo.

## Goal
One self-contained ROS 2 package so students edit only four files and never touch the TurtleBot3 packages.

## Layout
``
tb3_sensor_lab/                 (git repo, cloned into ~/ev_ws/src)
|-- README.md                   student steps (provided)
|-- .gitignore                  build/ install/ log/
|-- package.xml                 ament_cmake; depends on ros_gz_sim, ros_gz_bridge,
|                               robot_state_publisher, rviz2, teleop_twist_keyboard
|-- CMakeLists.txt              install(DIRECTORY config launch models rviz urdf worlds ...)
|-- launch/lab.launch.py        see below
|-- config/bridge.yaml          bridge entries (students add lines)
|-- models/waffle/
|   |-- model.config
|   `-- model.sdf               copy of the Waffle model (students edit)
|-- urdf/waffle.urdf            copy of the Waffle URDF (students edit)
|-- worlds/lab_world.sdf        copy of the TurtleBot3 world (students edit)
`-- rviz/lab.rviz               displays: TF, LaserScan, Image, PointCloud2 (disabled)
```

## What each file contains

**launch/lab.launch.py** starts, with `use_sim_time: true` everywhere:
1. `gz sim` with `worlds/lab_world.sdf` (via `ros_gz_sim`)
2. `robot_state_publisher` with `urdf/waffle.urdf`
3. spawn of the Waffle model (`ros_gz_sim create`)
4. `ros_gz_bridge parameter_bridge` with `config/bridge.yaml`
5. `rviz2` with `rviz/lab.rviz`

**config/bridge.yaml** ships with `/clock`, `/cmd_vel`, `/odom`, `/tf`, `/joint_states`, `/scan`, `/imu`, `/camera/image_raw` and `/camera/camera_info` already working. Leave a marker at the end:
```yaml
# TODO (Step 3): add depth camera entries here
# TODO (Step 4): add GNSS entry here
```

**models/waffle/model.sdf** has the working LiDAR, IMU and RGB camera. Add markers:
```xml
<!-- TODO (Step 3): copy the camera sensor and make a depth_camera (rgbd_camera) -->
<!-- TODO (Step 4): add gps_link, navsat sensor and a fixed joint to the base -->
```

**urdf/waffle.urdf** ships complete for the existing sensors. Marker: `<!-- TODO (Step 4): add gps_link and gps_joint -->`.

**worlds/lab_world.sdf** must already load the physics, scene-broadcaster, user-commands, Sensors (ogre2) and IMU systems. Markers:
```xml
<!-- TODO (Step 4): add NavSat system plugin -->
<!-- TODO (Step 4): add spherical_coordinates -->
```

**rviz/lab.rviz** has Fixed Frame `odom`, TF, LaserScan on `/scan`, Image on `/camera/image_raw`, and a PointCloud2 display on `/camera/depth/points` that starts empty.

## Branches
- `main`: starter (all TODOs present)
- `day2-solution`: finished repo for students who fall behind (depth camera, GNSS, bridge lines, world plugin)

## Pre-class checks
1. Run the finished solution on a student-like machine or VM. Check CPU load with all sensors on; lower camera size and rate if needed.
2. Confirm the exact SDF model name, base link name, camera link and frame names in the Waffle model, and update the README and slides to match.
3. Confirm `gz topic -l` shows `depth_camera/...` topics after the guided step, and note the exact suffixes (image, depth_image, points).
4. Confirm `/fix` frame_id is `gps_link` (set via `gz_frame_id`).
5. Check that the Gazebo GUI and RViz run on the student machines. Prepare a headless fallback if not.
6. Check `git push` is not required; students commit locally (some have no accounts).
