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
    gps_launch_file = os.path.join(pkg_ev_bringup, 'launch', 'gps.launch.py')
    imu_launch_file = os.path.join(pkg_ev_bringup, 'launch', 'imu.launch.py')

    # Launch arguments
    use_imu_arg = DeclareLaunchArgument(
        'use_imu',
        default_value='true',
        description='Launch WT901 IMU driver node'
    )
    use_gps_arg = DeclareLaunchArgument(
        'use_gps',
        default_value='true',
        description='Launch Holybro M9N GNSS driver node'
    )
    imu_port_arg = DeclareLaunchArgument(
        'imu_port',
        default_value='/dev/ttyIMU',
        description='Serial port for WT901 IMU (e.g. /dev/ttyIMU or /dev/ttyUSB0)'
    )
    imu_baud_arg = DeclareLaunchArgument(
        'imu_baud',
        default_value='9600',
        description='Baud rate for WT901 IMU (hardware default is 9600)'
    )
    gps_port_arg = DeclareLaunchArgument(
        'gps_port',
        default_value='/dev/ttyGPS',
        description='Serial port for Holybro M9N GNSS (e.g. /dev/ttyGPS or /dev/ttyACM0)'
    )
    gps_baud_arg = DeclareLaunchArgument(
        'gps_baud',
        default_value='115200',
        description='Baud rate for Holybro M9N GNSS'
    )
    use_rviz_arg = DeclareLaunchArgument(
        'use_rviz',
        default_value='true',
        description='Launch RViz 2 to view vehicle and sensor frames'
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

    # Holybro M9N NMEA GNSS Sub-launch
    gps_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(gps_launch_file),
        launch_arguments={
            'port': LaunchConfiguration('gps_port'),
            'baud': LaunchConfiguration('gps_baud'),
            'frame_id': 'gps_link'
        }.items(),
        condition=IfCondition(LaunchConfiguration('use_gps'))
    )

    # WT901 IMU Sub-launch
    imu_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(imu_launch_file),
        launch_arguments={
            'port': LaunchConfiguration('imu_port'),
            'baud': LaunchConfiguration('imu_baud'),
            'frame_id': 'imu_link'
        }.items(),
        condition=IfCondition(LaunchConfiguration('use_imu'))
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
        use_imu_arg,
        use_gps_arg,
        imu_port_arg,
        imu_baud_arg,
        gps_port_arg,
        gps_baud_arg,
        use_rviz_arg,
        robot_state_publisher_node,
        gps_launch,
        imu_launch,
        rviz_node
    ])

