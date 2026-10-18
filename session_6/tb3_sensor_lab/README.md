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
mkdir -p ~/ev_ws/src && cd ~/ev_ws/src
git clone https://github.com/Mo-Elshamy/Smart_EV_Kit_2.git   # skip if already cloned
cd ~/ev_ws/src/Smart_EV_Kit_2
git pull
git switch -c day2-<your-name>
cd ~/ev_ws
colcon build --symlink-install --packages-select tb3_sensor_lab
source install/setup.bash
gz sim --version
```
All files you edit are in `~/ev_ws/src/Smart_EV_Kit_2/session_6/tb3_sensor_lab/`.

**Expected:** the version says Harmonic (8.x). **If it fails:** you forgot `source`, or you are in the wrong folder (`pwd`).

## Step 1: Launch the world (Checkpoint 1)

```bash
ros2 launch tb3_sensor_lab lab.launch.py
```
**Expected:** Gazebo shows a grey robot inside a 4 m x 4 m walled room with an orange box and a blue cylinder. RViz shows the robot model, TF axes and red LiDAR points on the walls. The simulation starts running automatically.

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

**3a. Sensor block.** Open `models/waffle/model.sdf`. Inside the link `camera_rgb_frame`, at the `TODO (Step 3)` marker, paste a copy of the whole `<sensor name="camera">` block. In the copy:
- change `name` to `depth_camera` and `type` to `rgbd_camera`
- change `<topic>` to `depth_camera`
- set the image to 320 x 240 and `<update_rate>` to 15
- keep `<gz_frame_id>camera_rgb_frame</gz_frame_id>`
- **delete the `<camera_info_topic>` line**, otherwise it clashes with the RGB camera

**3b. World plugin.** Open `worlds/lab_world.sdf` and check the Sensors system is loaded (the LiDAR already needs it).

**3c. Bridge.** Relaunch, then run `gz topic -l | grep depth`. You should see:
```text
/depth_camera/camera_info
/depth_camera/depth_image
/depth_camera/image
/depth_camera/points
```
Then add to `config/bridge.yaml`:
```yaml
- ros_topic_name: "camera/depth/points"
  gz_topic_name: "depth_camera/points"
  ros_type_name: "sensor_msgs/msg/PointCloud2"
  gz_type_name: "gz.msgs.PointCloudPacked"
  direction: GZ_TO_ROS

- ros_topic_name: "camera/depth/image_raw"
  gz_topic_name: "depth_camera/depth_image"
  ros_type_name: "sensor_msgs/msg/Image"
  gz_type_name: "gz.msgs.Image"
  direction: GZ_TO_ROS
```

**3d. Verify.** Relaunch (no rebuild needed with `--symlink-install`), then in RViz tick the existing **Depth PointCloud** display (it is already set to `/camera/depth/points`).
```bash
ros2 topic hz /camera/depth/points
ros2 topic echo /camera/depth/points --once --field header.frame_id
```
**Expected:** a point cloud of the walls and the orange box. **If empty:** check the world plugin and the topic names with `gz topic -l`.

## Step 4: Challenge, add GNSS (Checkpoint 4)

Goal: a `/fix` topic (NavSatFix) that changes as you drive. Try it yourself first and open a hint only if stuck.

<details><summary>Hint 1: link and sensor</summary>

In `model.sdf`, add `<link name="gps_link">` with **its own** `<pose>-0.05 0 0.20 0 0 0</pose>`. Link poses are relative to the model origin; a joint pose does **not** move the link. Give it a small `<inertial>` like the other sensor links, and a `navsat` sensor (`<topic>navsat</topic>`, `<update_rate>5</update_rate>`, `<gz_frame_id>gps_link</gz_frame_id>`). Add a fixed joint `gps_joint` with parent `base_link` and child `gps_link`.

In `urdf/waffle.urdf`, add `gps_link` and a fixed `gps_joint` with `<origin xyz="-0.05 0 0.19"/>` (relative to `base_link`), just like you did on Day 1.
</details>

<details><summary>Hint 2: world plugin and origin</summary>

In `worlds/lab_world.sdf`, replace the two Step 4 TODO markers with:
```xml
<plugin filename="gz-sim-navsat-system" name="gz::sim::systems::NavSat"/>

<spherical_coordinates>
  <surface_model>EARTH_WGS84</surface_model>
  <world_frame_orientation>ENU</world_frame_orientation>
  <latitude_deg>30.0444</latitude_deg>
  <longitude_deg>31.2357</longitude_deg>
  <elevation>0</elevation>
  <heading_deg>0</heading_deg>
</spherical_coordinates>
```
You may use any latitude and longitude you like.
</details>

<details><summary>Hint 3: bridge</summary>

Add an entry from Gazebo topic `navsat` (type `gz.msgs.NavSat`) to ROS topic `fix` (type `sensor_msgs/msg/NavSatFix`), direction `GZ_TO_ROS`.
</details>

```bash
ros2 topic echo /fix
```
**Expected:** latitude and longitude change as you drive. About 1e-5 degrees of latitude is roughly 1 meter.

## Step 5: Verify and submit (Checkpoint 5)

### 5a. Verification Table
Fill in this table for every sensor and save it as `sensor_table.md`:

| Sensor | Topic | Message type | frame_id | Rate (Hz) |
|---|---|---|---|---|
| LiDAR | | | | |
| IMU | | | | |
| RGB camera | | | | |
| Depth camera | | | | |
| GNSS | | | | |

Use `ros2 topic list -t`, `ros2 topic hz <topic>` and `ros2 topic echo <topic> --once --field header.frame_id`. Then run `ros2 run rqt_graph rqt_graph` to verify `ros_gz_bridge`.

---

### 5b. Submission Guide (Pull Request)

Most students copy and work on `tb3_sensor_lab` inside an external ROS 2 workspace (e.g., `~/ev_ws/src/`). When you have completed and verified your lab, submit your work via GitHub Pull Request:

#### 1. Place Your Deliverables in the Submission Folder
Inside your local cloned `Smart_EV_Kit_2` repository, create a dedicated folder for your team or name:
```text
session_6/submissions/<team_or_participant_name>/
```

Using **VS Code Explorer**, **Ubuntu Files (GUI)**, or your preferred file manager, copy and paste the following files from your working workspace into that folder:
1. `model.sdf` (with depth camera and GNSS sensor blocks).
2. `waffle.urdf` (with GNSS link and joint).
3. `lab_world.sdf` (with NavSat plugin and spherical coordinates).
4. `bridge.yaml` (with depth camera and GNSS bridge entries).
5. `sensor_table.md` (your completed verification table from above).
6. *(Optional)* A screenshot showing the RViz point cloud and `/fix` echo in the terminal.

#### 2. Create an Isolated Branch & Push
In your terminal, navigate to your cloned `Smart_EV_Kit_2` repository:

```bash
cd ~/ev_ws/src/Smart_EV_Kit_2   # (use the path where you cloned Smart_EV_Kit_2)

# 1. Create and switch to your isolated PR branch (MUST start with pr_)
git checkout -b pr_session6_<team_or_participant_name>

# 2. Stage only your submission folder
git add session_6/submissions/<team_or_participant_name>

# 3. Commit your deliverables
git commit -m "feat(session6): submit deliverables for <team_or_participant_name>"

# 4. Push your branch to GitHub
git push origin pr_session6_<team_or_participant_name>
```

#### 3. Open a Pull Request & Stop
1. Go to [Smart_EV_Kit_2 on GitHub](https://github.com/Mo-Elshamy/Smart_EV_Kit_2).
2. You will see a yellow banner with your branch name. Click **"Compare & pull request"**.
3. Set the PR Title: `[Session 6 Submission] <Team or Participant Name>`.
4. Verify that:
   - **Base repository/branch:** `main`
   - **Head repository/branch:** `pr_session6_<team_or_participant_name>`
5. Click the green **"Create pull request"** button.

> ⛔ **IMPORTANT — STOP HERE!**
> Do **NOT** merge or close the pull request yourself. Once your pull request is created, your submission is complete. The instructor will review your files, validate the sensor data, and accept/merge the pull request.


## Stretch goals

- Rename topics and frames to the Day 1 vehicle names (`/imu/data`, `/camera/color/image_raw`).
- Add a noise block to the IMU sensor.
- Change the depth camera's `gz_frame_id` to `camera_rgb_optical_frame`, relaunch, and explain what happens to the point cloud in RViz.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No `/fix` topic | Bridge line missing | Check `bridge.yaml` and `gz topic -l` |
| `/fix` never changes | No `spherical_coordinates` | Add it to the world file |
| `/fix` frame is `waffle::gps_link::navsat` | Missing `gz_frame_id` | Add `<gz_frame_id>gps_link</gz_frame_id>` |
| Empty image or cloud | Sensors system missing | Check world plugins |
| Sensor data appears at the robot's centre / on the ground | Pose put on the joint, not the link | Give the link its own `<pose>` |
| Two publishers on `/camera/camera_info` | Copied `<camera_info_topic>` into the depth camera | Delete that line from the depth camera |
| RViz shows nothing | Fixed Frame or sim time | Set Fixed Frame, check `/clock` |
| Robot will not move | Teleop not focused, or paused | Click the teleop terminal, press play |
| Edits have no effect | Not rebuilt or relaunched | `colcon build --symlink-install`, relaunch |
| `Warning: XML Element[gz_frame_id] ... not defined in SDF` | Harmless | Ignore it |
