import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import ExecuteProcess, SetEnvironmentVariable
from launch_ros.actions import Node


def generate_launch_description():
    pkg_share = get_package_share_directory('tb3_sensor_lab')
    world_file = os.path.join(pkg_share, 'worlds', 'lab_world.sdf')
    urdf_file = os.path.join(pkg_share, 'urdf', 'waffle.urdf')
    bridge_yaml = os.path.join(pkg_share, 'config', 'bridge.yaml')
    rviz_cfg = os.path.join(pkg_share, 'rviz', 'lab.rviz')
    model_file = os.path.join(pkg_share, 'models', 'waffle', 'model.sdf')

    with open(urdf_file, 'r') as f:
        robot_description = f.read()

    gz_resource_path = os.pathsep.join([pkg_share, os.path.join(pkg_share, 'models')])
    existing = os.environ.get('GZ_SIM_RESOURCE_PATH', '')
    if existing:
        gz_resource_path = os.pathsep.join([gz_resource_path, existing])

    return LaunchDescription([
        SetEnvironmentVariable('GZ_SIM_RESOURCE_PATH', gz_resource_path),

        # Gazebo Harmonic, started running (-r)
        ExecuteProcess(cmd=['gz', 'sim', '-r', world_file], output='screen'),

        # URDF must be passed as a PARAMETER, not a CLI argument
        Node(
            package='robot_state_publisher',
            executable='robot_state_publisher',
            name='robot_state_publisher',
            parameters=[{'robot_description': robot_description, 'use_sim_time': True}],
            output='screen',
        ),

        # Spawn the robot (create waits until the world is up)
        Node(
            package='ros_gz_sim',
            executable='create',
            name='spawn_waffle',
            arguments=['-world', 'lab_world', '-file', model_file, '-name', 'waffle',
                       '-x', '0', '-y', '0', '-z', '0'],
            output='screen',
        ),

        Node(
            package='ros_gz_bridge',
            executable='parameter_bridge',
            name='ros_gz_bridge',
            parameters=[{'config_file': bridge_yaml, 'use_sim_time': True}],
            output='screen',
        ),

        Node(
            package='rviz2',
            executable='rviz2',
            name='rviz2',
            arguments=['-d', rviz_cfg],
            parameters=[{'use_sim_time': True}],
            output='screen',
        ),
    ])
