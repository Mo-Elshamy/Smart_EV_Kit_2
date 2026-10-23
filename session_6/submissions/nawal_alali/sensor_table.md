
# Day 2 — Sensor Verification Table

| Sensor | Topic | Message type | frame_id | Rate (Hz) |
|---|---|---|---|---|
| LiDAR | `/scan` | `sensor_msgs/msg/LaserScan` | `base_scan` | ~0.8 |
| IMU | `/imu` | `sensor_msgs/msg/Imu` | `imu_link` | ~14.4 |
| RGB camera | `/camera/image_raw` | `sensor_msgs/msg/Image` | `camera_rgb_frame` | ~0.5 |
| Depth camera | `/camera/depth/points` | `sensor_msgs/msg/PointCloud2` | `camera_rgb_frame` | ~2.4–3.6 |
| GNSS | `/fix` | `sensor_msgs/msg/NavSatFix` | `gps_link` | ~5 (from timestamps) |

Note: These are observed rates during simulation. Performance may fluctuate under WSL2.
