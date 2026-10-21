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
    pkg_zed_wrapper = get_package_share_directory('zed_wrapper')

    default_xacro_path = os.path.join(pkg_ev_description, 'urdf', 'ev_buggy.urdf.xacro')
    default_rviz_config = os.path.join(pkg_ev_bringup, 'config', 'rviz_config.rviz')
    zed_params_file = os.path.join(pkg_ev_bringup, 'config', 'zed2i_params.yaml')
    zed_launch_file = os.path.join(pkg_zed_wrapper, 'launch', 'zed_camera.launch.py')

    camera_model_arg = DeclareLaunchArgument(
        'camera_model',
        default_value='zed2i',
        description='ZED Camera Model (zed2i)'
    )
    camera_name_arg = DeclareLaunchArgument(
        'camera_name',
        default_value='zed',
        description='Namespace and camera node name prefix'
    )
    use_rviz_arg = DeclareLaunchArgument(
        'use_rviz',
        default_value='true',
        description='Launch RViz 2 to view depth images and point clouds'
    )

    # Robot State Publisher for vehicle kinematics & sensor mounts
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

    # Stereolabs ZED Wrapper Launch
    zed_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(zed_launch_file),
        launch_arguments={
            'camera_model': LaunchConfiguration('camera_model'),
            'camera_name': LaunchConfiguration('camera_name'),
            'ros_params_override_path': zed_params_file,
            'publish_tf': 'false',
            'publish_map_tf': 'false',
            'publish_urdf': 'true'
        }.items()
    )

    # RViz 2 Visualizer
    rviz_node = Node(
        package='rviz2',
        executable='rviz2',
        name='rviz2',
        output='screen',
        arguments=['-d', default_rviz_config],
        condition=IfCondition(LaunchConfiguration('use_rviz'))
    )

    return LaunchDescription([
        camera_model_arg,
        camera_name_arg,
        use_rviz_arg,
        robot_state_publisher_node,
        zed_launch,
        rviz_node
    ])
