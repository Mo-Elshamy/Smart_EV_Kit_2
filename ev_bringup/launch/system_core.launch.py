import os
import sys
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration

# Import auto port detection
sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
from port_utils import find_lidar_port, find_imu_port, find_gps_port

def generate_launch_description():
    pkg_ev_bringup = get_package_share_directory('ev_bringup')
    pkg_ev_localization = get_package_share_directory('ev_localization')
    pkg_ev_web_dashboard = get_package_share_directory('ev_web_dashboard')

    slam_launch_file = os.path.join(pkg_ev_localization, 'launch', 'mapping_slam.launch.py')
    bridge_launch_file = os.path.join(pkg_ev_bringup, 'launch', 'web_video.launch.py')
    web_launch_file = os.path.join(pkg_ev_web_dashboard, 'launch', 'web_dashboard.launch.py')

    # Top-Level Configuration Arguments
    enable_slam_arg = DeclareLaunchArgument(
        'enable_slam',
        default_value='true',
        description='Launch full LiDAR + EKF + 2D SLAM mapping stack'
    )
    enable_bridge_arg = DeclareLaunchArgument(
        'enable_bridge',
        default_value='true',
        description='Launch rosbridge (:9090) and web_video_server (:8080)'
    )
    enable_web_arg = DeclareLaunchArgument(
        'enable_web',
        default_value='true',
        description='Launch Web Command Center HTTP server (:3000)'
    )
    use_rviz_arg = DeclareLaunchArgument(
        'use_rviz',
        default_value='true',
        description='Open native RViz 2 visualizer on Jetson display'
    )

    # Hardware & Sensor Arguments
    use_lidar_arg = DeclareLaunchArgument(
        'use_lidar',
        default_value='true',
        description='Enable Slamtec RPLIDAR S3'
    )
    lidar_port_arg = DeclareLaunchArgument(
        'lidar_port',
        default_value=find_lidar_port(),
        description='Serial port for RPLIDAR S3 (auto-detected if omitted)'
    )
    use_zed_arg = DeclareLaunchArgument(
        'use_zed',
        default_value='true',
        description='Enable Stereolabs ZED 2i stereo depth camera'
    )
    use_imu_arg = DeclareLaunchArgument(
        'use_imu',
        default_value='true',
        description='Enable WitMotion WT901 IMU'
    )
    imu_port_arg = DeclareLaunchArgument(
        'imu_port',
        default_value=find_imu_port(),
        description='Serial port for WT901 IMU (auto-detected if omitted)'
    )
    imu_baud_arg = DeclareLaunchArgument(
        'imu_baud',
        default_value='9600',
        description='Baud rate for WT901 IMU'
    )
    use_gps_arg = DeclareLaunchArgument(
        'use_gps',
        default_value='false',
        description='Enable Holybro M9N GNSS (set true when outdoors)'
    )
    gps_port_arg = DeclareLaunchArgument(
        'gps_port',
        default_value=find_gps_port(),
        description='Serial port for GNSS receiver (auto-detected if omitted)'
    )
    gps_baud_arg = DeclareLaunchArgument(
        'gps_baud',
        default_value='115200',
        description='Baud rate for GNSS receiver'
    )
    use_gps_odom_arg = DeclareLaunchArgument(
        'use_gps_odom',
        default_value='false',
        description='Fuse GNSS coordinates into EKF odometry'
    )

    # 1. Full Navigation & SLAM Stack (ev_localization)
    slam_stack_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(slam_launch_file),
        launch_arguments={
            'use_rviz': LaunchConfiguration('use_rviz'),
            'use_lidar': LaunchConfiguration('use_lidar'),
            'lidar_port': LaunchConfiguration('lidar_port'),
            'use_zed': LaunchConfiguration('use_zed'),
            'use_imu': LaunchConfiguration('use_imu'),
            'imu_port': LaunchConfiguration('imu_port'),
            'imu_baud': LaunchConfiguration('imu_baud'),
            'use_gps': LaunchConfiguration('use_gps'),
            'gps_port': LaunchConfiguration('gps_port'),
            'gps_baud': LaunchConfiguration('gps_baud'),
            'use_gps_odom': LaunchConfiguration('use_gps_odom')
        }.items(),
        condition=IfCondition(LaunchConfiguration('enable_slam'))
    )

    # 2. Telemetry & Video Bridge (:9090 & :8080)
    bridge_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(bridge_launch_file),
        condition=IfCondition(LaunchConfiguration('enable_bridge'))
    )

    # 3. Web Command Center HTTP Server (:3000)
    web_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(web_launch_file),
        condition=IfCondition(LaunchConfiguration('enable_web'))
    )

    return LaunchDescription([
        enable_slam_arg,
        enable_bridge_arg,
        enable_web_arg,
        use_rviz_arg,
        use_lidar_arg,
        lidar_port_arg,
        use_zed_arg,
        use_imu_arg,
        imu_port_arg,
        imu_baud_arg,
        use_gps_arg,
        gps_port_arg,
        gps_baud_arg,
        use_gps_odom_arg,
        slam_stack_launch,
        bridge_launch,
        web_launch
    ])
