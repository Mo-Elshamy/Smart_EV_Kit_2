#!/usr/bin/env python3
import os
import glob
import subprocess

def release_port_locks(port):
    """
    Releases any stale/orphaned processes holding the serial port,
    preventing [Errno 16] Device or resource busy crashes.
    """
    if not port or not os.path.exists(port):
        return
    real_path = os.path.realpath(port)
    try:
        cmd = f"fuser {real_path} 2>/dev/null"
        out = subprocess.check_output(cmd, shell=True).decode().strip()
        pids = out.split()
        my_pid = str(os.getpid())
        for pid in pids:
            if pid and pid != my_pid:
                subprocess.call(f"kill -9 {pid} 2>/dev/null", shell=True)
    except Exception:
        pass


def find_lidar_port(fallback='/dev/ttyUSB0'):
    """
    Auto-detects Slamtec RPLIDAR S3 (Silicon Labs CP2102N / 10c4:ea60).
    Checks udev symlinks, /dev/serial/by-id/, and fallback /dev/ttyUSB*.
    """
    port = fallback
    for symlink in ['/dev/ttyLIDAR', '/dev/rplidar']:
        if os.path.exists(symlink):
            port = symlink
            break
    else:
        by_id_dir = '/dev/serial/by-id'
        if os.path.exists(by_id_dir):
            for fname in os.listdir(by_id_dir):
                lower = fname.lower()
                if any(k in lower for k in ['cp210', 'silicon_labs', 'rplidar', 'slamtec']):
                    resolved = os.path.realpath(os.path.join(by_id_dir, fname))
                    if os.path.exists(resolved):
                        port = resolved
                        break
        else:
            ttys = sorted(glob.glob('/dev/ttyUSB*'))
            if ttys:
                port = ttys[0]

    release_port_locks(port)
    return port


def find_imu_port(fallback='/dev/ttyIMU'):
    """
    Auto-detects WitMotion WT901 IMU (CH340 / QinHeng / 1a86:7523).
    Checks udev symlinks, /dev/serial/by-id/, and available serial ports.
    """
    port = fallback
    if os.path.exists('/dev/ttyIMU'):
        port = '/dev/ttyIMU'
    else:
        by_id_dir = '/dev/serial/by-id'
        if os.path.exists(by_id_dir):
            for fname in os.listdir(by_id_dir):
                lower = fname.lower()
                if any(k in lower for k in ['ch340', 'ch341', 'witmotion', 'wt901', '1a86', 'qinheng']):
                    resolved = os.path.realpath(os.path.join(by_id_dir, fname))
                    if os.path.exists(resolved):
                        port = resolved
                        break
        else:
            ttys = sorted(glob.glob('/dev/ttyUSB*'))
            if len(ttys) > 1:
                port = ttys[1]

    release_port_locks(port)
    return port


def find_gps_port(fallback='/dev/ttyGPS'):
    """
    Auto-detects Holybro Micro M9N GNSS (FTDI / 0403:6015 / u-blox / ttyACM).
    Checks udev symlinks, /dev/serial/by-id/, and ACM/USB device nodes.
    """
    port = fallback
    if os.path.exists('/dev/ttyGPS'):
        port = '/dev/ttyGPS'
    else:
        by_id_dir = '/dev/serial/by-id'
        if os.path.exists(by_id_dir):
            for fname in os.listdir(by_id_dir):
                lower = fname.lower()
                if any(k in lower for k in ['ftdi', '0403', 'holybro', 'm9n', 'u-blox', 'ublox', 'gps', 'gnss']):
                    resolved = os.path.realpath(os.path.join(by_id_dir, fname))
                    if os.path.exists(resolved):
                        port = resolved
                        break
        else:
            acms = sorted(glob.glob('/dev/ttyACM*'))
            if acms:
                port = acms[0]
            else:
                ttys = sorted(glob.glob('/dev/ttyUSB*'))
                if len(ttys) > 1:
                    port = ttys[1]

    release_port_locks(port)
    return port
