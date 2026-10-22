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
    scripts/setup_imu.sh
  DESTINATION lib/${PROJECT_NAME}
)

ament_package()
