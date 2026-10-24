import os
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

def generate_launch_description():
    pkg_ev_bringup = get_package_share_directory('ev_bringup')
    pkg_ev_localization = get_package_share_directory('ev_localization')
    pkg_slam_toolbox = get_package_share_directory('slam_toolbox')

    default_slam_params = os.path.join(pkg_ev_localization, 'config', 'slam_toolbox_params.yaml')
    default_rviz_config = os.path.join(pkg_ev_bringup, 'config', 'rviz_config.rviz')
    lidar_launch_file = os.path.join(pkg_ev_bringup, 'launch', 'lidar.launch.py')
    localization_launch_file = os.path.join(pkg_ev_localization, 'launch', 'localization.launch.py')
    slam_launch_file = os.path.join(pkg_slam_toolbox, 'launch', 'online_async_launch.py')

    # Launch Arguments
    use_rviz_arg = DeclareLaunchArgument(
        'use_rviz',
        default_value='true',
        description='Launch RViz 2 visualizer with SLAM map layout'
    )
    use_lidar_arg = DeclareLaunchArgument(
        'use_lidar',
        default_value='true',
        description='Launch RPLIDAR S3 and roll-cage pillar filter'
    )
    lidar_port_arg = DeclareLaunchArgument(
        'lidar_port',
        default_value='/dev/ttyLIDAR',
        description='Serial port for RPLIDAR S3 (/dev/ttyLIDAR or /dev/ttyUSB0)'
    )
    lidar_baud_arg = DeclareLaunchArgument(
        'lidar_baud',
        default_value='1000000',
        description='Baud rate for RPLIDAR S3 (1000000 baud)'
    )
    use_zed_arg = DeclareLaunchArgument(
        'use_zed',
        default_value='true',
        description='Launch ZED 2i camera for visual odometry'
    )
    use_imu_arg = DeclareLaunchArgument(
        'use_imu',
        default_value='true',
        description='Launch WT901 IMU for attitude fusion'
    )
    imu_port_arg = DeclareLaunchArgument(
        'imu_port',
        default_value='/dev/ttyIMU',
        description='Serial port for WT901 IMU'
    )
    imu_baud_arg = DeclareLaunchArgument(
        'imu_baud',
        default_value='9600',
        description='Baud rate for WT901 IMU (9600 hardware default)'
    )
    use_gps_arg = DeclareLaunchArgument(
        'use_gps',
        default_value='false',
        description='Launch Holybro M9N GNSS (disabled indoors / desk testing)'
    )
    use_gps_odom_arg = DeclareLaunchArgument(
        'use_gps_odom',
        default_value='false',
        description='Fuse GPS coordinates into odometry via navsat_transform_node'
    )
    slam_params_file_arg = DeclareLaunchArgument(
        'slam_params_file',
        default_value=default_slam_params,
        description='Path to slam_toolbox configuration YAML file'
    )

    # 1. LiDAR + Roll-cage filter bringup
    lidar_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(lidar_launch_file),
        launch_arguments={
            'serial_port': LaunchConfiguration('lidar_port'),
            'serial_baudrate': LaunchConfiguration('lidar_baud'),
            'frame_id': 'laser_frame',
            'use_filter': 'true'
        }.items(),
        condition=IfCondition(LaunchConfiguration('use_lidar'))
    )

    # 2. Sensor fusion localization (EKF publishing odom -> base_link)
    localization_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(localization_launch_file),
        launch_arguments={
            'use_zed': LaunchConfiguration('use_zed'),
            'use_imu': LaunchConfiguration('use_imu'),
            'imu_port': LaunchConfiguration('imu_port'),
            'imu_baud': LaunchConfiguration('imu_baud'),
            'use_gps': LaunchConfiguration('use_gps'),
            'use_gps_odom': LaunchConfiguration('use_gps_odom'),
            'use_rviz': 'false'
        }.items()
    )

    # 3. slam_toolbox online asynchronous SLAM (Lifecycle configured and activated)
    slam_toolbox_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(slam_launch_file),
        launch_arguments={
            'slam_params_file': LaunchConfiguration('slam_params_file'),
            'use_sim_time': 'false',
            'autostart': 'true'
        }.items()
    )

    # 4. RViz 2 Visualizer
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
        use_lidar_arg,
        lidar_port_arg,
        lidar_baud_arg,
        use_zed_arg,
        use_imu_arg,
        imu_port_arg,
        imu_baud_arg,
        use_gps_arg,
        use_gps_odom_arg,
        slam_params_file_arg,
        lidar_launch,
        localization_launch,
        slam_toolbox_launch,
        rviz_node
    ])
