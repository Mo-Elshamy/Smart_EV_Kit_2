from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

def generate_launch_description():
    port_arg = DeclareLaunchArgument(
        'port',
        default_value='/dev/ttyIMU',
        description='Serial port for WT901 IMU (e.g. /dev/ttyIMU or /dev/ttyUSB0)'
    )
    baud_arg = DeclareLaunchArgument(
        'baud',
        default_value='115200',
        description='Baud rate for WT901 IMU'
    )
    frame_id_arg = DeclareLaunchArgument(
        'frame_id',
        default_value='imu_link',
        description='TF frame_id for IMU messages'
    )

    witmotion_imu_node = Node(
        package='witmotion_ros',
        executable='witmotion_ros_node',
        name='witmotion_imu_node',
        output='screen',
        parameters=[{
            'port': LaunchConfiguration('port'),
            'baud_rate': LaunchConfiguration('baud'),
            'polling_interval': 10,
            'timeout_ms': 150,
            'restart_service_name': '/restart_imu',
            'imu_publisher.topic_name': '/imu/data',
            'imu_publisher.frame_id': LaunchConfiguration('frame_id'),
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

    return LaunchDescription([
        port_arg,
        baud_arg,
        frame_id_arg,
        witmotion_imu_node
    ])

