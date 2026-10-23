#!/usr/bin/env python3
import os
import sys
import threading
import socket
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from ament_index_python.packages import get_package_share_directory
import rclpy
from rclpy.node import Node

class EvDashboardRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Enable CORS and disable aggressive caching for real-time asset updates
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        super().end_headers()

    def log_message(self, format, *args):
        # Suppress routine GET logs to prevent terminal spam
        pass

class HttpServerNode(Node):
    def __init__(self):
        super().__init__('ev_web_dashboard_server')
        self.declare_parameter('port', 3000)
        self.declare_parameter('host', '0.0.0.0')

        port = self.get_parameter('port').get_parameter_value().integer_value
        host = self.get_parameter('host').get_parameter_value().string_value

        # Locate www directory (check installed share first, then source directory)
        try:
            pkg_share = get_package_share_directory('ev_web_dashboard')
            www_dir = os.path.join(pkg_share, 'www')
        except Exception:
            www_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'www'))

        if not os.path.exists(www_dir):
            alt_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'www'))
            if os.path.exists(alt_dir):
                www_dir = alt_dir

        self.get_logger().info(f'Serving Web Command Center from: {www_dir}')

        class BoundHandler(EvDashboardRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=www_dir, **kwargs)

        self.server = ThreadingHTTPServer((host, port), BoundHandler)
        self.server_thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.server_thread.start()

        local_ip = self._get_local_ip()
        self.get_logger().info('=' * 65)
        self.get_logger().info('  🚀 Smart EV Web Command Center Live:')
        self.get_logger().info(f'     Local:   http://localhost:{port}')
        self.get_logger().info(f'     Network: http://{local_ip}:{port}')
        self.get_logger().info('=' * 65)

    def _get_local_ip(self):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(('8.8.8.8', 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return '127.0.0.1'

    def destroy_node(self):
        if hasattr(self, 'server'):
            self.server.shutdown()
            self.server.server_close()
        super().destroy_node()

def main(args=None):
    rclpy.init(args=args)
    node = HttpServerNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()

if __name__ == '__main__':
    main()
