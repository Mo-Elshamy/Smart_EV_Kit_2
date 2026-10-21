import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import Command, LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue

def generate_launch_description():
    pkg_ev_description = get_package_share_directory('ev_description')
    pkg_ev_bringup = get_package_share_directory('ev_bringup')

    default_xacro_path = os.path.join(pkg_ev_description, 'urdf', 'ev_buggy.urdf.xacro')
    default_rviz_config = os.path.join(pkg_ev_bringup, 'config', 'rviz_config.rviz')
    lidar_launch_file = os.path.join(pkg_ev_bringup, 'launch', 'lidar.launch.py')

    # Launch arguments
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
    use_filter_arg = DeclareLaunchArgument(
        'use_filter',
        default_value='true',
        description='Enable laser filter chain to mask roll-cage pillars'
    )
    use_rviz_arg = DeclareLaunchArgument(
        'use_rviz',
        default_value='true',
        description='Launch RViz 2 to view LiDAR scan and robot frames'
    )

    # Robot State Publisher (URDF / TF2)
    robot_description_content = ParameterValue(
        Command(['xacro ', default_xacro_path]),
        value_type=str
    )

    robot_state_publisher_node = Node(
        package='robot_state_publisher',
        executable='robot_state_publisher',
        name='robot_state_publisher',
        output='screen',
        parameters=[{
            'robot_description': robot_description_content,
            'use_sim_time': False
        }]
    )

    # LiDAR Sub-launch
    lidar_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(lidar_launch_file),
        launch_arguments={
            'serial_port': LaunchConfiguration('serial_port'),
            'serial_baudrate': LaunchConfiguration('serial_baudrate'),
            'frame_id': LaunchConfiguration('frame_id'),
            'use_filter': LaunchConfiguration('use_filter')
        }.items()
    )

    # RViz 2
    rviz_node = Node(
        package='rviz2',
        executable='rviz2',
        name='rviz2',
        output='screen',
        arguments=['-d', default_rviz_config],
        condition=IfCondition(LaunchConfiguration('use_rviz'))
    )

    return LaunchDescription([
        serial_port_arg,
        serial_baudrate_arg,
        frame_id_arg,
        use_filter_arg,
        use_rviz_arg,
        robot_state_publisher_node,
        lidar_launch,
        rviz_node
    ])
