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
    default_rviz_config = os.path.join(pkg_ev_bringup, 'config', 'full_system_rviz.rviz')

    use_rviz_arg = DeclareLaunchArgument(
        'use_rviz',
        default_value='true',
        description='Launch RViz 2 to view kinematic frames'
    )

    robot_description_content = ParameterValue(
        Command([
            'xacro ',
            default_xacro_path
        ]),
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

    rviz_node = Node(
        package='rviz2',
        executable='rviz2',
        name='rviz2',
        output='screen',
        arguments=['-d', default_rviz_config],
        condition=IfCondition(LaunchConfiguration('use_rviz'))
    )

    return LaunchDescription([
        use_rviz_arg,
        robot_state_publisher_node,
        rviz_node
    ])
