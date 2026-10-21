import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.conditions import IfCondition
from launch.substitutions import Command, LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue

def generate_launch_description():
    pkg_ev_description = get_package_share_directory('ev_description')
    pkg_ev_bringup = get_package_share_directory('ev_bringup')

    default_xacro_path = os.path.join(pkg_ev_description, 'urdf', 'ev_buggy.urdf.xacro')
    default_rviz_config = os.path.join(pkg_ev_bringup, 'config', 'rviz_config.rviz')

    # Launch arguments
    imu_port_arg = DeclareLaunchArgument(
        'imu_port',
        default_value='/dev/ttyIMU',
        description='Serial port for WT901 IMU (e.g. /dev/ttyIMU or /dev/ttyUSB0)'
    )
    imu_baud_arg = DeclareLaunchArgument(
        'imu_baud',
        default_value='115200',
        description='Baud rate for WT901 IMU'
    )
    gps_port_arg = DeclareLaunchArgument(
        'gps_port',
        default_value='/dev/ttyGPS',
        description='Serial port for Holybro M9N GNSS (e.g. /dev/ttyGPS or /dev/ttyACM0)'
    )
    gps_baud_arg = DeclareLaunchArgument(
        'gps_baud',
        default_value='38400',
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

    # WT901 IMU Node
    witmotion_imu_node = Node(
        package='witmotion_ros',
        executable='witmotion_ros_node',
        name='witmotion_imu_node',
        output='screen',
        parameters=[{
            'port': LaunchConfiguration('imu_port'),
            'baud_rate': 115200,
            'polling_interval': 10,
            'timeout_ms': 150,
            'restart_service_name': '/restart_imu',
            'imu_publisher.topic_name': '/imu/data',
            'imu_publisher.frame_id': 'imu_link',
            'imu_publisher.use_native_orientation': True,
            'temperature_publisher.enabled': False,
            'magnetometer_publisher.enabled': False,
            'barometer_publisher.enabled': False,
            'altimeter_publisher.enabled': False,
            'orientation_publisher.enabled': True,
            'gps_publisher.enabled': False,
            'rtc_publisher.enabled': False
        }]
    )

    # Holybro M9N NMEA GNSS Node
    nmea_gps_node = Node(
        package='nmea_navsat_driver',
        executable='nmea_serial_driver',
        name='nmea_gps_node',
        output='screen',
        parameters=[{
            'port': LaunchConfiguration('gps_port'),
            'baud': 38400,
            'frame_id': 'gps_link',
            'time_ref_source': 'gps',
            'useRMC': False
        }]
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
        imu_port_arg,
        imu_baud_arg,
        gps_port_arg,
        gps_baud_arg,
        use_rviz_arg,
        robot_state_publisher_node,
        witmotion_imu_node,
        nmea_gps_node,
        rviz_node
    ])
