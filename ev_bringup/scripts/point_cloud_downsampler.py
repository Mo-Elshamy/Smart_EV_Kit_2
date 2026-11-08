#!/usr/bin/env python3
"""
PointCloud2 Downsampler Node with Dynamic Scan Mode Control
Supports:
  - '2d': Pauses point cloud processing completely (0% CPU / 0 bandwidth for 2D SLAM priority)
  - '3d': High-density 3D spatial scanning (~5,000 pts/msg @ 4 Hz, with ZED GPU spatial mapping support)
  - 'hybrid': Balanced preview (~1,500 pts/msg @ 2.5 Hz)
Controls:
  - Listens on topic '/scan_mode' (std_msgs/msg/String: '2d', '3d', 'hybrid')
"""

import math
import struct
import time
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from sensor_msgs.msg import PointCloud2
from std_msgs.msg import String

class PointCloudDownsampler(Node):
    def __init__(self):
        super().__init__('point_cloud_downsampler')

        self.declare_parameter('input_topic', '/zed/zed_node/point_cloud/cloud_registered')
        self.declare_parameter('fused_input_topic', '/zed/zed_node/mapping/fused_cloud')
        self.declare_parameter('output_topic', '/zed/point_cloud_downsampled')
        self.declare_parameter('initial_mode', 'hybrid')

        self.in_topic = self.get_parameter('input_topic').value
        self.fused_in_topic = self.get_parameter('fused_input_topic').value
        self.out_topic = self.get_parameter('output_topic').value
        self.current_mode = self.get_parameter('initial_mode').value.lower()

        # Dynamic mode profiles
        self.mode_profiles = {
            '2d': {'enabled': False, 'target_points': 0, 'min_interval': 1.0},
            '3d': {'enabled': True, 'target_points': 5000, 'min_interval': 0.25},
            'hybrid': {'enabled': True, 'target_points': 1500, 'min_interval': 0.35}
        }

        self.last_pub_time = 0.0

        qos_sub = QoSProfile(
            reliability=ReliabilityPolicy.BEST_EFFORT,
            history=HistoryPolicy.KEEP_LAST,
            depth=2
        )

        qos_pub = QoSProfile(
            reliability=ReliabilityPolicy.RELIABLE,
            history=HistoryPolicy.KEEP_LAST,
            depth=5
        )

        # Standard live point cloud subscriber
        self.sub_raw = self.create_subscription(
            PointCloud2,
            self.in_topic,
            self.cloud_callback,
            qos_sub
        )

        # Fused ZED spatial mapping subscriber (active when mapping is enabled)
        self.sub_fused = self.create_subscription(
            PointCloud2,
            self.fused_in_topic,
            self.cloud_callback,
            qos_sub
        )

        # Mode command subscriber
        self.sub_mode = self.create_subscription(
            String,
            '/scan_mode',
            self.mode_callback,
            10
        )

        # Mode status publisher
        self.pub_mode_status = self.create_publisher(
            String,
            '/scan_mode_status',
            10
        )

        self.pub = self.create_publisher(
            PointCloud2,
            self.out_topic,
            qos_pub
        )

        self.apply_mode(self.current_mode)
        self.get_logger().info(f'PointCloudDownsampler initialized in [{self.current_mode.upper()}] mode')

    def mode_callback(self, msg: String):
        requested = msg.data.strip().lower()
        if requested in self.mode_profiles:
            self.apply_mode(requested)
        else:
            self.get_logger().warn(f'Unknown scan mode requested: {requested}. Valid modes: 2d, 3d, hybrid')

    def apply_mode(self, mode: str):
        self.current_mode = mode
        profile = self.mode_profiles[mode]
        self.is_enabled = profile['enabled']
        self.target_points = profile['target_points']
        self.min_interval = profile['min_interval']

        status_msg = String()
        status_msg.data = mode
        self.pub_mode_status.publish(status_msg)

        if not self.is_enabled:
            self.get_logger().info('Mode [2D ONLY]: Point cloud streaming PAUSED (0% CPU / bandwidth dedicated to 2D SLAM)')
        else:
            self.get_logger().info(f'Mode [{mode.upper()}]: Target {self.target_points} pts @ {1.0/self.min_interval:.1f}Hz')

    def cloud_callback(self, msg: PointCloud2):
        if not self.is_enabled:
            return

        now = time.time()
        if now - self.last_pub_time < self.min_interval:
            return

        data = msg.data
        ps = msg.point_step
        if ps < 12 or len(data) < ps:
            return

        total_points = len(data) // ps
        stride = max(1, total_points // self.target_points)

        out_data = bytearray()
        count = 0

        unpack = struct.unpack_from
        for i in range(0, len(data) - ps + 1, ps * stride):
            x, y, z = unpack('<fff', data, i)
            if not math.isnan(x) and not math.isinf(x):
                out_data.extend(data[i:i + ps])
                count += 1
                if count >= self.target_points * 2:
                    break

        if count == 0:
            return

        out_msg = PointCloud2()
        out_msg.header = msg.header
        out_msg.height = 1
        out_msg.width = count
        out_msg.fields = msg.fields
        out_msg.is_bigendian = msg.is_bigendian
        out_msg.point_step = ps
        out_msg.row_step = count * ps
        out_msg.data = bytes(out_data)
        out_msg.is_dense = True

        self.pub.publish(out_msg)
        self.last_pub_time = now

def main(args=None):
    rclpy.init(args=args)
    node = PointCloudDownsampler()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
