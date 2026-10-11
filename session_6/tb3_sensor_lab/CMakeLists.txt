cmake_minimum_required(VERSION 3.8)
project(tb3_sensor_lab LANGUAGES NONE)

find_package(ament_cmake REQUIRED)

install(
  DIRECTORY
    launch
    config
    models
    rviz
    urdf
    worlds
  DESTINATION share/${PROJECT_NAME}
)

ament_package()
