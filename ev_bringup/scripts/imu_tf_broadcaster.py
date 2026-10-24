#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Imu
from geometry_msgs.msg import TransformStamped
import tf2_ros

class ImuTfBroadcaster(Node):
    def __init__(self):
        super().__init__('imu_tf_broadcaster')
        self.declare_parameter('parent_frame', 'world')
        self.declare_parameter('child_frame', 'imu_link')
        self.declare_parameter('topic_name', '/imu/data')

        self.parent_frame = self.get_parameter('parent_frame').get_parameter_value().string_value
        self.child_frame = self.get_parameter('child_frame').get_parameter_value().string_value
        topic = self.get_parameter('topic_name').get_parameter_value().string_value

        self.tf_broadcaster = tf2_ros.TransformBroadcaster(self)
        self.sub = self.create_subscription(Imu, topic, self.imu_callback, 10)
        self.received_count = 0
        self.get_logger().info(f'Broadcasting {self.parent_frame} -> {self.child_frame} from {topic}')

    def imu_callback(self, msg: Imu):
        q = msg.orientation
        norm_sq = q.x*q.x + q.y*q.y + q.z*q.z + q.w*q.w
        if norm_sq < 0.001:
            if self.received_count % 50 == 0:
                self.get_logger().warn('Received IMU orientation is all zeros! Check driver orientation settings.')
            self.received_count += 1
            return

        t = TransformStamped()
        t.header.stamp = self.get_clock().now().to_msg()
        t.header.frame_id = self.parent_frame
        t.child_frame_id = self.child_frame
        t.transform.translation.x = 0.0
        t.transform.translation.y = 0.0
        t.transform.translation.z = 0.2
        t.transform.rotation = q
        self.tf_broadcaster.sendTransform(t)

        self.received_count += 1
        if self.received_count == 1 or self.received_count % 50 == 0:
            self.get_logger().info(f'Live IMU Orientation: Q=[x:{q.x:.2f}, y:{q.y:.2f}, z:{q.z:.2f}, w:{q.w:.2f}]')

def main(args=None):
    rclpy.init(args=args)
    node = ImuTfBroadcaster()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
