import os
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

def generate_launch_description():
    port_arg = DeclareLaunchArgument(
        'port',
        default_value='3000',
        description='Port for web dashboard HTTP server'
    )
    host_arg = DeclareLaunchArgument(
        'host',
        default_value='0.0.0.0',
        description='Host bind address for web dashboard HTTP server'
    )

    http_server_node = Node(
        package='ev_web_dashboard',
        executable='http_server_node.py',
        name='ev_web_dashboard_server',
        output='screen',
        parameters=[{
            'port': LaunchConfiguration('port'),
            'host': LaunchConfiguration('host')
        }]
    )

    return LaunchDescription([
        port_arg,
        host_arg,
        http_server_node
    ])
