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

    gz_resource_path = os.pathsep.join([
        pkg_share,
        os.path.join(pkg_share, 'models'),
    ])
    existing = os.environ.get('GZ_SIM_RESOURCE_PATH', '')
    if existing:
        gz_resource_path = os.pathsep.join([gz_resource_path, existing])

    return LaunchDescription([
        SetEnvironmentVariable('GZ_SIM_RESOURCE_PATH', gz_resource_path),

        ExecuteProcess(
            cmd=['gz', 'sim', '-r', world_file],
            output='screen',
            additional_env={'GZ_SIM_RESOURCE_PATH': gz_resource_path},
        ),

        Node(
            package='robot_state_publisher',
            executable='robot_state_publisher',
            name='robot_state_publisher',
            arguments=['--robot-description', open(urdf_file).read()],
            parameters=[{'use_sim_time': True}],
            output='screen',
        ),

        ExecuteProcess(
            cmd=['ros2', 'run', 'ros_gz_sim', 'create', '-file', model_file, '-name', 'waffle', '-x', '0', '-y', '0', '-z', '0'],
            output='screen',
            additional_env={'GZ_SIM_RESOURCE_PATH': gz_resource_path},
        ),

        Node(
            package='ros_gz_bridge',
            executable='parameter_bridge',
            name='ros_gz_bridge',
            arguments=['--ros-args', '-p', f'config_file:={bridge_yaml}'],
            parameters=[{'use_sim_time': True}],
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
