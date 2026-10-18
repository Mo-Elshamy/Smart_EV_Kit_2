# Sensor Verification Table

| Sensor | Topic | Message type | frame_id | Rate (Hz) |
|---|---|---|---|---:|
| LiDAR | /scan | sensor_msgs/msg/LaserScan | base_scan | 3.74 |
| IMU | /imu | sensor_msgs/msg/Imu | imu_link | 81.60 |
| RGB camera | /camera/image_raw | sensor_msgs/msg/Image | camera_rgb_frame | 5.17 |
| Depth camera | /camera/depth/points | sensor_msgs/msg/PointCloud2 | camera_rgb_frame | 3.47 |
| GNSS | /fix | sensor_msgs/msg/NavSatFix | gps_link | 2.26 |