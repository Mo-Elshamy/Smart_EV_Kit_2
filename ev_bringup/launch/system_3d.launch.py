import os
import sys
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration

def generate_launch_description():
    pkg_ev_bringup = get_package_share_directory('ev_bringup')
    system_web_launch_file = os.path.join(pkg_ev_bringup, 'launch', 'system_web.launch.py')

    use_rviz_arg = DeclareLaunchArgument(
        'use_rviz',
        default_value='false',
        description='Open native RViz 2 visualizer alongside Web Dashboard'
    )
    use_gps_arg = DeclareLaunchArgument(
        'use_gps',
        default_value='true',
        description='Enable Holybro M9N GNSS receiver'
    )
    use_lidar_arg = DeclareLaunchArgument(
        'use_lidar',
        default_value='false',
        description='Enable Slamtec RPLIDAR S3 (disabled by default in pure 3D mode)'
    )

    # Launch system_web configured purely for 3D Spatial Scanning
    system_web_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(system_web_launch_file),
        launch_arguments={
            'mapping_mode': '3d',
            'enable_slam': 'false',
            'use_lidar': LaunchConfiguration('use_lidar'),
            'use_zed': 'true',
            'use_gps': LaunchConfiguration('use_gps'),
            'use_rviz': LaunchConfiguration('use_rviz')
        }.items()
    )

    return LaunchDescription([
        use_rviz_arg,
        use_gps_arg,
        use_lidar_arg,
        system_web_launch
    ])
