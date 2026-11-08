#!/usr/bin/env python3
"""
PointCloud2 Downsampler Node for Web Telemetry
Subscribes to raw ZED 2i registered point cloud (114,688 points, 1.83 MB)
and downsamples to ~2,000 spatial points (26 KB) at 2-3 Hz.
Prevents rosbridge WebSocket write queue saturation and client browser stalls.
"""

import math
import struct
import time
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from sensor_msgs.msg import PointCloud2

class PointCloudDownsampler(Node):
    def __init__(self):
        super().__init__('point_cloud_downsampler')

        self.declare_parameter('input_topic', '/zed/zed_node/point_cloud/cloud_registered')
        self.declare_parameter('output_topic', '/zed/point_cloud_downsampled')
        self.declare_parameter('target_points', 2000)
        self.declare_parameter('min_interval_sec', 0.35) # ~3 Hz max rate

        in_topic = self.get_parameter('input_topic').value
        out_topic = self.get_parameter('output_topic').value
        self.target_points = self.get_parameter('target_points').value
        self.min_interval = self.get_parameter('min_interval_sec').value

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

        self.sub = self.create_subscription(
            PointCloud2,
            in_topic,
            self.cloud_callback,
            qos_sub
        )

        self.pub = self.create_publisher(
            PointCloud2,
            out_topic,
            qos_pub
        )

        self.get_logger().info(f'Downsampler running: {in_topic} -> {out_topic} (~{self.target_points} pts @ {1.0/self.min_interval:.1f}Hz)')

    def cloud_callback(self, msg: PointCloud2):
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

        # Little endian float unpacker
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
