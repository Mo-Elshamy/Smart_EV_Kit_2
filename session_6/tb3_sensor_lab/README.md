# Day 2 Lab: Add Sensors to a TurtleBot3 Waffle

You will launch a TurtleBot3 Waffle in Gazebo, look at the sensors it already has, then add two it is missing (a depth camera and GNSS) and see their data in RViz 2 and the terminal.

> Names of files and topics below follow the lab repo. If something is named differently on your machine, use `ros2 topic list` and `gz topic -l` to find the real name.

## The pattern for every sensor

1. Sensor block: add the sensor to the robot model (SDF).
2. World plugin: make sure the world loads the system for that sensor type.
3. Bridge line: add one entry to `config/bridge.yaml`.
4. Verify: check it in RViz or the terminal.

## Step 0: Set up

First, install Gazebo and the ROS 2 tools (once only; skip if your instructor already did this):
```bash
source /opt/ros/jazzy/setup.bash
sudo apt update
sudo apt install -y ros-jazzy-ros-gz \
  ros-jazzy-teleop-twist-keyboard \
  ros-jazzy-rqt-image-view ros-jazzy-rqt-graph
```
`ros-jazzy-ros-gz` brings Gazebo Harmonic and the bridge (`ros_gz_bridge`, `ros_gz_sim`) with it.

Then get the lab code, build and check Gazebo:
```bash
cd ~/ev_ws/src/tb3_sensor_lab
git pull
git switch -c day2-<your-name>
cd ~/ev_ws
colcon build --symlink-install
source install/setup.bash
gz sim --version
```
**Expected:** the version says Harmonic (8.x). **If it fails:** you forgot `source`, or you are in the wrong folder (`pwd`).

## Step 1: Launch the world (Checkpoint 1)

```bash
ros2 launch tb3_sensor_lab lab.launch.py
```
**Expected:** Gazebo shows the robot among walls, and RViz opens. Press the play button in Gazebo if it is paused.

## Step 2: Drive and observe existing sensors (Checkpoint 2)

Open new terminals (remember to `source` in each one).

```bash
ros2 run teleop_twist_keyboard teleop_twist_keyboard
ros2 topic echo /odom --once
ros2 topic echo /imu --once
ros2 topic hz /scan
ros2 run rqt_image_view rqt_image_view
```
**Expected:** `/odom` changes as you drive, the scan follows the walls in RViz, and the camera image shows the world. Keep the teleop terminal focused or the keys do nothing.

## Step 3: Guided, add a depth camera (Checkpoint 3)

**3a. Sensor block.** Open `models/waffle/model.sdf`. Find the existing camera sensor, copy it, and change the type to `rgbd_camera`, the name to `depth_camera` and the topic to `depth_camera`. Set the image to 320 x 240 and the update rate to 15.

**3b. World plugin.** Open `worlds/lab_world.sdf` and check the Sensors system is loaded (the LiDAR already needs it).

**3c. Bridge.** Run `gz topic -l | grep depth` to see the Gazebo names. Then add to `config/bridge.yaml`:
```yaml
- ros_topic_name: "camera/depth/points"
  gz_topic_name: "depth_camera/points"
  ros_type_name: "sensor_msgs/msg/PointCloud2"
  gz_type_name: "gz.msgs.PointCloudPacked"
  direction: GZ_TO_ROS
```
Add a second entry for the depth image (`gz.msgs.Image` to `sensor_msgs/msg/Image`).

**3d. Verify.** Relaunch, then in RViz add a PointCloud2 display on `/camera/depth/points`.
```bash
ros2 topic hz /camera/depth/points
ros2 topic echo /camera/depth/points --once --field header.frame_id
```
**Expected:** a point cloud of the walls. **If empty:** check the world plugin and the topic names with `gz topic -l`.

## Step 4: Challenge, add GNSS (Checkpoint 4)

Goal: a `/fix` topic (NavSatFix) that changes as you drive. Try it yourself first and open a hint only if stuck.

<details><summary>Hint 1: link and sensor</summary>

In `model.sdf`, add a link `gps_link` with a `navsat` sensor (topic `navsat`, update rate 5, `gz_frame_id` set to `gps_link`) and a fixed joint to the robot base. In `urdf/waffle.urdf`, add the same link and joint (this is what you did on Day 1).
</details>

<details><summary>Hint 2: world plugin and origin</summary>

In `worlds/lab_world.sdf`, add the NavSat system plugin (`gz-sim-navsat-system`) and a `spherical_coordinates` block with a latitude and longitude of your choice.
</details>

<details><summary>Hint 3: bridge</summary>

Add an entry from Gazebo topic `navsat` (type `gz.msgs.NavSat`) to ROS topic `fix` (type `sensor_msgs/msg/NavSatFix`), direction `GZ_TO_ROS`.
</details>

```bash
ros2 topic echo /fix
```
**Expected:** latitude and longitude change as you drive. About 1e-5 degrees of latitude is roughly 1 meter.

## Step 5: Verify and submit (Checkpoint 5)

Fill in this table for every sensor:

| Sensor | Topic | Message type | frame_id | Rate (Hz) |
|---|---|---|---|---|
| LiDAR | | | | |
| IMU | | | | |
| RGB camera | | | | |
| Depth camera | | | | |
| GNSS | | | | | |

Use `ros2 topic list -t`, `ros2 topic hz <topic>` and `ros2 topic echo <topic> --once --field header.frame_id`. Then run `ros2 run rqt_graph rqt_graph` and find `ros_gz_bridge`. Commit your work:
```bash
git add -A
git commit -m "day2: add depth camera and gnss"
```

## Stretch goals

- Rename topics and frames to the Day 1 vehicle names (`/imu/data`, `/camera/color/image_raw`).
- Add a noise block to the IMU sensor.
- Remove the optical frame setting from the camera and watch the point cloud turn sideways.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No `/fix` topic | Bridge line missing | Check `bridge.yaml` and `gz topic -l` |
| `/fix` never changes | No `spherical_coordinates` | Add it to the world file |
| Empty image or cloud | Sensors system missing | Check world plugins |
| RViz shows nothing | Fixed Frame or sim time | Set Fixed Frame, check `/clock` |
| Robot will not move | Teleop not focused, or paused | Click the teleop terminal, press play |
| Edits have no effect | Not rebuilt or relaunched | `colcon build --symlink-install`, relaunch |

---

This version is aligned to the real TurtleBot3 Waffle naming used in the official `turtlebot3_gazebo` package for ROS 2 Jazzy. If your system exposes slightly different topic names, use the actual names from `ros2 topic list` and `gz topic -l`.
