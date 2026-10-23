#!/usr/bin/env python3
import os
import glob

def find_lidar_port(fallback='/dev/ttyUSB0'):
    """
    Auto-detects Slamtec RPLIDAR S3 (Silicon Labs CP2102N / 10c4:ea60).
    Checks udev symlinks, /dev/serial/by-id/, and fallback /dev/ttyUSB*.
    """
    for symlink in ['/dev/ttyLIDAR', '/dev/rplidar']:
        if os.path.exists(symlink):
            return symlink

    by_id_dir = '/dev/serial/by-id'
    if os.path.exists(by_id_dir):
        for fname in os.listdir(by_id_dir):
            lower = fname.lower()
            if any(k in lower for k in ['cp210', 'silicon_labs', 'rplidar', 'slamtec']):
                resolved = os.path.realpath(os.path.join(by_id_dir, fname))
                if os.path.exists(resolved):
                    return resolved

    ttys = sorted(glob.glob('/dev/ttyUSB*'))
    if ttys:
        return ttys[0]

    return fallback


def find_imu_port(fallback='/dev/ttyIMU'):
    """
    Auto-detects WitMotion WT901 IMU (CH340 / QinHeng / 1a86:7523).
    Checks udev symlinks, /dev/serial/by-id/, and available serial ports.
    """
    if os.path.exists('/dev/ttyIMU'):
        return '/dev/ttyIMU'

    by_id_dir = '/dev/serial/by-id'
    if os.path.exists(by_id_dir):
        for fname in os.listdir(by_id_dir):
            lower = fname.lower()
            if any(k in lower for k in ['ch340', 'ch341', 'witmotion', 'wt901', '1a86', 'qinheng']):
                resolved = os.path.realpath(os.path.join(by_id_dir, fname))
                if os.path.exists(resolved):
                    return resolved

    # Fallback to second USB serial if LiDAR is on the first
    ttys = sorted(glob.glob('/dev/ttyUSB*'))
    if len(ttys) > 1:
        return ttys[1]

    return fallback


def find_gps_port(fallback='/dev/ttyGPS'):
    """
    Auto-detects Holybro Micro M9N GNSS (FTDI / 0403:6015 / u-blox / ttyACM).
    Checks udev symlinks, /dev/serial/by-id/, and ACM/USB device nodes.
    """
    if os.path.exists('/dev/ttyGPS'):
        return '/dev/ttyGPS'

    by_id_dir = '/dev/serial/by-id'
    if os.path.exists(by_id_dir):
        for fname in os.listdir(by_id_dir):
            lower = fname.lower()
            if any(k in lower for k in ['ftdi', '0403', 'holybro', 'm9n', 'u-blox', 'ublox', 'gps', 'gnss']):
                resolved = os.path.realpath(os.path.join(by_id_dir, fname))
                if os.path.exists(resolved):
                    return resolved

    acms = sorted(glob.glob('/dev/ttyACM*'))
    if acms:
        return acms[0]

    # Fallback to third USB serial if LiDAR and IMU occupy 0 and 1
    ttys = sorted(glob.glob('/dev/ttyUSB*'))
    if len(ttys) > 2:
        return ttys[2]

    return fallback

