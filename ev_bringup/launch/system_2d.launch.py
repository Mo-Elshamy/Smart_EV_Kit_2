import os
import sys
from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration

# Import auto port detection
sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
from port_utils import find_lidar_port, find_imu_port, find_gps_port

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
    use_zed_arg = DeclareLaunchArgument(
        'use_zed',
        default_value='true',
        description='Enable Stereolabs ZED 2i camera for visual odometry & RGB feed'
    )

    # Launch system_web configured purely for 2D SLAM
    system_web_launch = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(system_web_launch_file),
        launch_arguments={
            'mapping_mode': '2d',
            'enable_slam': 'true',
            'use_lidar': 'true',
            'use_zed': LaunchConfiguration('use_zed'),
            'use_gps': LaunchConfiguration('use_gps'),
            'use_rviz': LaunchConfiguration('use_rviz')
        }.items()
    )

    return LaunchDescription([
        use_rviz_arg,
        use_gps_arg,
        use_zed_arg,
        system_web_launch
    ])
