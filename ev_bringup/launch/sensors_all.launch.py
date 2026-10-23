import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration

def generate_launch_description():
    pkg_ev_bringup = get_package_share_directory('ev_bringup')

    lidar_launch_file = os.path.join(pkg_ev_bringup, 'launch', 'lidar.launch.py')
    imu_launch_file = os.path.join(pkg_ev_bringup, 'launch', 'imu.launch.py')
    gps_launch_file = os.path.join(pkg_ev_bringup, 'launch', 'gps.launch.py')
    camera_launch_file = os.path.join(pkg_ev_bringup, 'launch', 'depth_camera.launch.py')

    # LiDAR Arguments (Slamtec RPLIDAR S3)
    use_lidar_arg = DeclareLaunchArgument(
        'use_lidar',
        default_value='true',
        description='Enable Slamtec RPLIDAR S3 (2D LiDAR)'
    )
    lidar_port_arg = DeclareLaunchArgument(
        'lidar_port',
        default_value='/dev/ttyLIDAR',
        description='Serial port for RPLIDAR S3 (/dev/ttyLIDAR or /dev/ttyUSB0)'
    )
    lidar_baud_arg = DeclareLaunchArgument(
        'lidar_baud',
        default_value='1000000',
        description='Baud rate for RPLIDAR S3'
    )

    # IMU Arguments (WitMotion WT901)
    use_imu_arg = DeclareLaunchArgument(
        'use_imu',
        default_value='true',
        description='Enable WitMotion WT901 9-Axis IMU'
    )
    imu_port_arg = DeclareLaunchArgument(
        'imu_port',
        default_value='/dev/ttyIMU',
        description='Serial port for WT901 IMU (/dev/ttyIMU or /dev/ttyUSB1)'
    )
    imu_baud_arg = DeclareLaunchArgument(
        'imu_baud',
        default_value='9600',
        description='Baud rate for WT901 IMU'
    )

    # GPS Arguments (Holybro M9N GNSS)
    use_gps_arg = DeclareLaunchArgument(
        'use_gps',
        default_value='true',
        description='Enable Holybro M9N GNSS Receiver'
    )
    gps_port_arg = DeclareLaunchArgument(
        'gps_port',
        default_value='/dev/ttyGPS',
        description='Serial port for Holybro M9N (/dev/ttyGPS or /dev/ttyUSB2)'
    )
    gps_baud_arg = DeclareLaunchArgument(
        'gps_baud',
        default_value='115200',
        description='Baud rate for Holybro M9N GNSS'
    )

    # Depth Camera Arguments (Stereolabs ZED 2i)
    use_zed_arg = DeclareLaunchArgument(
        'use_zed',
        default_value='true',
        description='Enable Stereolabs ZED 2i Stereo Depth Camera'
    )
    camera_model_arg = DeclareLaunchArgument(
        'camera_model',
        default_value='zed2i',
        description='ZED Camera Model (zed2i)'
    )

    # 1. LiDAR Sub-launch
    lidar_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(lidar_launch_file),
        launch_arguments={
            'serial_port': LaunchConfiguration('lidar_port'),
            'serial_baudrate': LaunchConfiguration('lidar_baud'),
            'frame_id': 'laser_frame',
            'use_filter': 'true'
        }.items(),
        condition=IfCondition(LaunchConfiguration('use_lidar'))
    )

    # 2. IMU Sub-launch
    imu_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(imu_launch_file),
        launch_arguments={
            'port': LaunchConfiguration('imu_port'),
            'baud': LaunchConfiguration('imu_baud'),
            'frame_id': 'imu_link'
        }.items(),
        condition=IfCondition(LaunchConfiguration('use_imu'))
    )

    # 3. GPS Sub-launch
    gps_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(gps_launch_file),
        launch_arguments={
            'port': LaunchConfiguration('gps_port'),
            'baud': LaunchConfiguration('gps_baud'),
            'frame_id': 'gps_link'
        }.items(),
        condition=IfCondition(LaunchConfiguration('use_gps'))
    )

    # 4. ZED 2i Depth Camera Sub-launch
    camera_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(camera_launch_file),
        launch_arguments={
            'camera_model': LaunchConfiguration('camera_model'),
            'use_rviz': 'false',
            'publish_robot_state': 'false'
        }.items(),
        condition=IfCondition(LaunchConfiguration('use_zed'))
    )

    return LaunchDescription([
        use_lidar_arg,
        lidar_port_arg,
        lidar_baud_arg,
        use_imu_arg,
        imu_port_arg,
        imu_baud_arg,
        use_gps_arg,
        gps_port_arg,
        gps_baud_arg,
        use_zed_arg,
        camera_model_arg,
        lidar_launch,
        imu_launch,
        gps_launch,
        camera_launch
    ])

