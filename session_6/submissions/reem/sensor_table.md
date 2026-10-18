# Sensor Verification

| Sensor | Topic | Message type | frame_id | Measured rate (Hz) |
|---|---|---|---|---|
| LiDAR | /scan | sensor_msgs/msg/LaserScan | base_scan | ~4.17 |
| IMU | /imu | sensor_msgs/msg/Imu | imu_link | ~62.5 |
| RGB camera | /camera/image_raw | sensor_msgs/msg/Image | camera_rgb_frame | ~4.4 |
| Depth camera | /camera/depth/points | sensor_msgs/msg/PointCloud2 | camera_rgb_optical_frame | ~3.4 |
| GNSS | /fix | sensor_msgs/msg/NavSatFix | gps_link | ~2.08 |

Rates are approximate observations from separate measurements.