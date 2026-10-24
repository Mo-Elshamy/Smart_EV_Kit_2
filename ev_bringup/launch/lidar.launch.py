import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.conditions import IfCondition
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

def generate_launch_description():
    pkg_ev_bringup = get_package_share_directory('ev_bringup')
    default_filter_config = os.path.join(pkg_ev_bringup, 'config', 'laser_filter_params.yaml')

    serial_port_arg = DeclareLaunchArgument(
        'serial_port',
        default_value='/dev/ttyLIDAR',
        description='Serial port for Slamtec RPLIDAR S3 (e.g. /dev/ttyLIDAR or /dev/ttyUSB0)'
    )
    serial_baudrate_arg = DeclareLaunchArgument(
        'serial_baudrate',
        default_value='1000000',
        description='Serial baudrate for Slamtec RPLIDAR S3 (1000000 baud)'
    )
    frame_id_arg = DeclareLaunchArgument(
        'frame_id',
        default_value='laser_frame',
        description='TF frame_id for LiDAR scan messages'
    )
    inverted_arg = DeclareLaunchArgument(
        'inverted',
        default_value='false',
        description='Whether to invert LiDAR scan data'
    )
    angle_compensate_arg = DeclareLaunchArgument(
        'angle_compensate',
        default_value='true',
        description='Enable angle compensation for scan data'
    )
    scan_mode_arg = DeclareLaunchArgument(
        'scan_mode',
        default_value='DenseBoost',
        description='Scan mode for RPLIDAR S3 (DenseBoost or Standard)'
    )
    use_filter_arg = DeclareLaunchArgument(
        'use_filter',
        default_value='true',
        description='Enable laser filter chain to mask roll-cage pillars'
    )

    # Slamtec S3 LiDAR Node
    sllidar_node = Node(
        package='sllidar_ros2',
        executable='sllidar_node',
        name='sllidar_node',
        output='screen',
        parameters=[{
            'channel_type': 'serial',
            'serial_port': LaunchConfiguration('serial_port'),
            'serial_baudrate': LaunchConfiguration('serial_baudrate'),
            'frame_id': LaunchConfiguration('frame_id'),
            'inverted': LaunchConfiguration('inverted'),
            'angle_compensate': LaunchConfiguration('angle_compensate'),
            'scan_mode': LaunchConfiguration('scan_mode')
        }]
    )

    # Roll-cage Laser Filter Node (/scan -> /scan_filtered)
    laser_filter_node = Node(
        package='laser_filters',
        executable='scan_to_scan_filter_chain',
        name='laser_filter',
        output='screen',
        parameters=[default_filter_config],
        remappings=[
            ('scan', '/scan'),
            ('scan_filtered', '/scan_filtered')
        ],
        condition=IfCondition(LaunchConfiguration('use_filter'))
    )

    return LaunchDescription([
        serial_port_arg,
        serial_baudrate_arg,
        frame_id_arg,
        inverted_arg,
        angle_compensate_arg,
        scan_mode_arg,
        use_filter_arg,
        sllidar_node,
        laser_filter_node
    ])
