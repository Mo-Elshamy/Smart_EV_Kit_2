cmake_minimum_required(VERSION 3.8)
project(ev_bringup)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

find_package(ament_cmake REQUIRED)

install(
  DIRECTORY launch config
  DESTINATION share/${PROJECT_NAME}
)

install(
  PROGRAMS
    scripts/imu_tf_broadcaster.py
    scripts/point_cloud_downsampler.py
    scripts/optimize_jetson.sh
    scripts/setup_imu.sh
    scripts/setup_gps.sh
    scripts/setup_lidar.sh
    scripts/setup_all_udev.sh
    scripts/launch_system_web.sh
  DESTINATION lib/${PROJECT_NAME}
)

ament_package()
