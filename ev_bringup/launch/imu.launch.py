import os
import sys
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.conditions import IfCondition
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

# Import auto port detection
sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
from port_utils import find_imu_port

def generate_launch_description():
    pkg_ev_bringup = get_package_share_directory('ev_bringup')
    default_rviz_config = os.path.join(pkg_ev_bringup, 'config', 'rviz_imu.rviz')

    port_arg = DeclareLaunchArgument(
        'port',
        default_value=find_imu_port(),
        description='Serial port for WT901 IMU (auto-detected if omitted)'
    )
    baud_arg = DeclareLaunchArgument(
        'baud',
        default_value='9600',
        description='Baud rate for WT901 IMU (hardware default is 9600)'
    )
    frame_id_arg = DeclareLaunchArgument(
        'frame_id',
        default_value='imu_link',
        description='TF frame_id for IMU messages'
    )
    use_rviz_arg = DeclareLaunchArgument(
        'use_rviz',
        default_value='false',
        description='Launch RViz2 to visualize live 3D orientation'
    )

    witmotion_imu_node = Node(
        package='witmotion_ros',
        executable='witmotion_ros_node',
        name='witmotion_imu_node',
        output='screen',
        parameters=[{
            'port': LaunchConfiguration('port'),
            'baud_rate': 9600,
            'polling_interval': 10,
            'timeout_ms': 0,
            'restart_service_name': '/restart_imu',
            'imu_publisher.topic_name': '/imu/data',
            'imu_publisher.frame_id': LaunchConfiguration('frame_id'),
            'imu_publisher.use_native_orientation': False,
            'imu_publisher.measurements.acceleration.enabled': True,
            'imu_publisher.measurements.angular_velocity.enabled': True,
            'imu_publisher.measurements.orientation.enabled': True,
            'temperature_publisher.enabled': False,
            'magnetometer_publisher.enabled': False,
            'barometer_publisher.enabled': False,
            'altimeter_publisher.enabled': False,
            'orientation_publisher.enabled': True,
            'gps_publisher.enabled': False,
            'rtc_publisher.enabled': False
        }]
    )

    imu_tf_broadcaster_node = Node(
        package='ev_bringup',
        executable='imu_tf_broadcaster.py',
        name='imu_tf_broadcaster',
        output='screen',
        parameters=[{
            'parent_frame': 'world',
            'child_frame': LaunchConfiguration('frame_id'),
            'topic_name': '/imu/data'
        }],
        condition=IfCondition(LaunchConfiguration('use_rviz'))
    )

    rviz_node = Node(
        package='rviz2',
        executable='rviz2',
        name='rviz2_imu',
        output='screen',
        arguments=['-d', default_rviz_config],
        condition=IfCondition(LaunchConfiguration('use_rviz'))
    )

    return LaunchDescription([
        port_arg,
        baud_arg,
        frame_id_arg,
        use_rviz_arg,
        witmotion_imu_node,
        imu_tf_broadcaster_node,
        rviz_node
    ])
