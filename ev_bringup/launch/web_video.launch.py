from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

def generate_launch_description():
    video_port_arg = DeclareLaunchArgument(
        'video_server_port',
        default_value='8080',
        description='HTTP MJPEG video streaming port'
    )
    video_address_arg = DeclareLaunchArgument(
        'video_server_address',
        default_value='0.0.0.0',
        description='Bind address for web_video_server'
    )
    rosbridge_port_arg = DeclareLaunchArgument(
        'rosbridge_port',
        default_value='9090',
        description='WebSocket bridge port for telemetry & maps'
    )

    web_video_server_node = Node(
        package='web_video_server',
        executable='web_video_server',
        name='web_video_server',
        output='screen',
        respawn=True,
        respawn_delay=2.0,
        parameters=[{
            'port': LaunchConfiguration('video_server_port'),
            'address': LaunchConfiguration('video_server_address'),
            'server_threads': 4
        }]
    )

    rosbridge_node = Node(
        package='rosbridge_server',
        executable='rosbridge_websocket',
        name='rosbridge_websocket',
        output='screen',
        respawn=True,
        respawn_delay=2.0,
        parameters=[{
            'port': LaunchConfiguration('rosbridge_port'),
            'address': '0.0.0.0',
            'ssl': False,
            'retry_startup_delay': 2.0,
            'use_compression': False,
            'max_message_size': 50000000,
            'write_queue_size': 2048
        }]
    )

    downsampler_node = Node(
        package='ev_bringup',
        executable='point_cloud_downsampler.py',
        name='point_cloud_downsampler',
        output='screen',
        respawn=True,
        respawn_delay=2.0
    )

    return LaunchDescription([
        video_port_arg,
        video_address_arg,
        rosbridge_port_arg,
        web_video_server_node,
        rosbridge_node,
        downsampler_node
    ])

