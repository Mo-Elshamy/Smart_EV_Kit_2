# Hardware & Third-Party Sensor Drivers (`ev_sensors`)

This directory contains the concrete hardware drivers for the Smart EV platform:
- `sllidar_ros2`: Slamtec RPLIDAR S3 driver (USB serial at 1000000 baud)
- `zed-ros2-wrapper`: Stereolabs ZED 2i stereo depth camera driver (HD720 @ 15 FPS)
- `zed-ros2-interfaces`: Stereolabs ROS 2 message definitions (`zed_msgs`)
- `witmotion_ros`: WitMotion WT901 9-axis IMU driver (/dev/ttyIMU at 115200 baud)
- `nmea_navsat_driver`: Holybro M9N GNSS driver (/dev/ttyGPS at 115200 baud)
