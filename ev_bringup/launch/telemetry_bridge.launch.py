import os
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

def generate_launch_description():
    rosbridge_port_arg = DeclareLaunchArgument(
        'rosbridge_port',
        default_value='9090',
        description='Port for rosbridge WebSocket server'
    )
    rosbridge_address_arg = DeclareLaunchArgument(
        'rosbridge_address',
        default_value='0.0.0.0',
        description='Bind address for rosbridge WebSocket server'
    )
    video_server_port_arg = DeclareLaunchArgument(
        'video_server_port',
        default_value='8080',
        description='Port for web_video_server (MJPEG streams)'
    )
    video_server_address_arg = DeclareLaunchArgument(
        'video_server_address',
        default_value='0.0.0.0',
        description='Bind address for web_video_server'
    )

    rosbridge_node = Node(
        package='rosbridge_server',
        executable='rosbridge_websocket',
        name='rosbridge_websocket',
        output='screen',
        parameters=[{
            'port': LaunchConfiguration('rosbridge_port'),
            'address': LaunchConfiguration('rosbridge_address'),
            'ssl': False,
            'retry_startup_delay': 2.0,
            'use_compression': False
        }]
    )

    web_video_server_node = Node(
        package='web_video_server',
        executable='web_video_server',
        name='web_video_server',
        output='screen',
        parameters=[{
            'port': LaunchConfiguration('video_server_port'),
            'address': LaunchConfiguration('video_server_address'),
            'server_threads': 2
        }]
    )

    return LaunchDescription([
        rosbridge_port_arg,
        rosbridge_address_arg,
        video_server_port_arg,
        video_server_address_arg,
        rosbridge_node,
        web_video_server_node
    ])
