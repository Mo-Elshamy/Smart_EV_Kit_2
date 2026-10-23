import os
import sys
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node

# Import auto port detection
sys.path.insert(0, os.path.dirname(os.path.realpath(__file__)))
from port_utils import find_gps_port

def generate_launch_description():
    port_arg = DeclareLaunchArgument(
        'port',
        default_value=find_gps_port(),
        description='Serial port for Holybro M9N GNSS (auto-detected if omitted)'
    )
    baud_arg = DeclareLaunchArgument(
        'baud',
        default_value='115200',
        description='Baud rate for Holybro M9N GNSS'
    )
    frame_id_arg = DeclareLaunchArgument(
        'frame_id',
        default_value='gps_link',
        description='TF frame_id for GPS messages'
    )
    use_rmc_arg = DeclareLaunchArgument(
        'useRMC',
        default_value='false',
        description='Use RMC sentence instead of GGA'
    )

    nmea_gps_node = Node(
        package='nmea_navsat_driver',
        executable='nmea_serial_driver',
        name='nmea_gps_node',
        output='screen',
        parameters=[{
            'port': LaunchConfiguration('port'),
            'baud': LaunchConfiguration('baud'),
            'frame_id': LaunchConfiguration('frame_id'),
            'time_ref_source': 'gps',
            'useRMC': LaunchConfiguration('useRMC')
        }]
    )

    return LaunchDescription([
        port_arg,
        baud_arg,
        frame_id_arg,
        use_rmc_arg,
        nmea_gps_node
    ])

