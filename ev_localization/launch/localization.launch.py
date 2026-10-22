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
    pkg_ev_localization = get_package_share_directory('ev_localization')

    default_xacro_path = os.path.join(pkg_ev_description, 'urdf', 'ev_buggy.urdf.xacro')
    default_rviz_config = os.path.join(pkg_ev_bringup, 'config', 'rviz_config.rviz')
    ekf_config_path = os.path.join(pkg_ev_localization, 'config', 'ekf_fusion_params.yaml')

    gps_launch_file = os.path.join(pkg_ev_bringup, 'launch', 'gps.launch.py')
    imu_launch_file = os.path.join(pkg_ev_bringup, 'launch', 'imu.launch.py')
    depth_camera_launch_file = os.path.join(pkg_ev_bringup, 'launch', 'depth_camera.launch.py')

    # Launch arguments
    use_zed_arg = DeclareLaunchArgument(
        'use_zed',
        default_value='true',
        description='Launch ZED 2i camera for visual odometry'
    )
    use_gps_arg = DeclareLaunchArgument(
        'use_gps',
        default_value='false',
        description='Launch Holybro M9N GNSS driver (set true when outdoors with GPS connected)'
    )
    use_imu_arg = DeclareLaunchArgument(
        'use_imu',
        default_value='true',
        description='Launch WT901 IMU driver'
    )
    use_gps_odom_arg = DeclareLaunchArgument(
        'use_gps_odom',
        default_value='false',
        description='Launch navsat_transform_node to fuse GPS into local odometry'
    )
    gps_port_arg = DeclareLaunchArgument(
        'gps_port',
        default_value='/dev/ttyGPS',
        description='Serial port for GNSS receiver'
    )
    gps_baud_arg = DeclareLaunchArgument(
        'gps_baud',
        default_value='115200',
        description='Baud rate for GNSS receiver'
    )
    imu_port_arg = DeclareLaunchArgument(
        'imu_port',
        default_value='/dev/ttyIMU',
        description='Serial port for WT901 IMU'
    )
    imu_baud_arg = DeclareLaunchArgument(
        'imu_baud',
        default_value='9600',
        description='Baud rate for WT901 IMU (hardware default is 9600)'
    )
    use_rviz_arg = DeclareLaunchArgument(
        'use_rviz',
        default_value='true',
        description='Launch RViz 2 visualizer'
    )

    # Robot State Publisher (TF2 Coordinate Tree)
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

    # Sensor Sub-launches
    gps_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(gps_launch_file),
        launch_arguments={
            'port': LaunchConfiguration('gps_port'),
            'baud': LaunchConfiguration('gps_baud'),
            'frame_id': 'gps_link'
        }.items(),
        condition=IfCondition(LaunchConfiguration('use_gps'))
    )

    imu_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(imu_launch_file),
        launch_arguments={
            'port': LaunchConfiguration('imu_port'),
            'baud': LaunchConfiguration('imu_baud'),
            'frame_id': 'imu_link'
        }.items(),
        condition=IfCondition(LaunchConfiguration('use_imu'))
    )

    depth_camera_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(depth_camera_launch_file),
        launch_arguments={
            'camera_model': 'zed2i',
            'use_rviz': 'false',
            'publish_robot_state': 'false'
        }.items(),
        condition=IfCondition(LaunchConfiguration('use_zed'))
    )

    # Extended Kalman Filter Node (robot_localization)
    ekf_node = Node(
        package='robot_localization',
        executable='ekf_node',
        name='ekf_filter_node',
        output='screen',
        parameters=[ekf_config_path],
        remappings=[
            ('odometry/filtered', '/odometry/filtered')
        ]
    )

    # NavSat Transform Node (Optional GPS Fusion)
    navsat_transform_node = Node(
        package='robot_localization',
        executable='navsat_transform_node',
        name='navsat_transform_node',
        output='screen',
        parameters=[ekf_config_path],
        remappings=[
            ('imu/data', '/imu/data'),
            ('gps/fix', '/fix'),
            ('odometry/filtered', '/odometry/filtered'),
            ('odometry/gps', '/odometry/gps')
        ],
        condition=IfCondition(LaunchConfiguration('use_gps_odom'))
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
        use_zed_arg,
        use_gps_arg,
        use_imu_arg,
        use_gps_odom_arg,
        gps_port_arg,
        gps_baud_arg,
        imu_port_arg,
        imu_baud_arg,
        use_rviz_arg,
        robot_state_publisher_node,
        gps_launch,
        imu_launch,
        depth_camera_launch,
        ekf_node,
        navsat_transform_node,
        rviz_node
    ])
