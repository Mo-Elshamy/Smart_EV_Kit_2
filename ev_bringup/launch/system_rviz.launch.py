import os
import sys
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

# Import auto port detection
sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
from port_utils import find_lidar_port, find_imu_port, find_gps_port

def generate_launch_description():
    pkg_ev_bringup = get_package_share_directory('ev_bringup')
    pkg_ev_localization = get_package_share_directory('ev_localization')

    slam_launch_file = os.path.join(pkg_ev_localization, 'launch', 'mapping_slam.launch.py')
    full_rviz_config = os.path.join(pkg_ev_bringup, 'config', 'full_system_rviz.rviz')

    # Top-Level Arguments
    enable_slam_arg = DeclareLaunchArgument(
        'enable_slam',
        default_value='true',
        description='Enable 2D SLAM mapping stack'
    )

    # Hardware Sensor Arguments
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
    lidar_baud_arg = DeclareLaunchArgument(
        'lidar_baud',
        default_value='1000000',
        description='Baud rate for RPLIDAR S3'
    )
    use_zed_arg = DeclareLaunchArgument(
        'use_zed',
        default_value='true',
        description='Enable Stereolabs ZED 2i camera'
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
        default_value='true',
        description='Enable Holybro M9N GNSS receiver'
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
        description='Fuse GNSS coordinates into EKF odometry (/odometry/gps)'
    )

    # 1. Full Navigation & SLAM Stack (Sensors + Description + EKF + SLAM)
    # Note: use_rviz is set to false here so we launch the dedicated full-screen RViz with full_system_rviz.rviz below
    slam_stack_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(slam_launch_file),
        launch_arguments={
            'use_rviz': 'false',
            'use_lidar': LaunchConfiguration('use_lidar'),
            'lidar_port': LaunchConfiguration('lidar_port'),
            'lidar_baud': LaunchConfiguration('lidar_baud'),
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

    # 2. RViz 2 with Complete Full-System Visualization Configuration
    # Displays: Model, TF, WT901 IMU, RPLIDAR S3, ZED RGB, ZED Depth, ZED 3D Cloud, EKF Odom, GPS Odom, SLAM Map
    rviz_node = Node(
        package='rviz2',
        executable='rviz2',
        name='rviz2',
        output='screen',
        arguments=['-d', full_rviz_config]
    )

    return LaunchDescription([
        enable_slam_arg,
        use_lidar_arg,
        lidar_port_arg,
        lidar_baud_arg,
        use_zed_arg,
        use_imu_arg,
        imu_port_arg,
        imu_baud_arg,
        use_gps_arg,
        gps_port_arg,
        gps_baud_arg,
        use_gps_odom_arg,
        slam_stack_launch,
        rviz_node
    ])

