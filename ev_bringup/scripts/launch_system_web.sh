#!/usr/bin/env bash
# Smart EV Buggy - Master Launch Script with Pre-flight USB Checks
set -e

# Pre-flight: Wait for USB sensor symlinks to enumerate (up to 10 seconds)
for i in $(seq 1 10); do
  if [ -e /dev/ttyLIDAR ] && [ -e /dev/ttyIMU ] && [ -e /dev/ttyGPS ]; then
    echo "[EV Bringup] All USB sensors detected: /dev/ttyLIDAR, /dev/ttyIMU, /dev/ttyGPS"
    break
  fi
  echo "[EV Bringup] Waiting for USB sensors to enumerate... ($i/10)"
  sleep 1
done

# Ensure safe device node permissions
chmod 666 /dev/ttyUSB* /dev/ttyLIDAR /dev/ttyIMU /dev/ttyGPS /dev/video* 2>/dev/null || true

# Release any port locks from previous runs
for dev in /dev/ttyLIDAR /dev/ttyIMU /dev/ttyGPS /dev/ttyUSB*; do
  if [ -e "$dev" ]; then
    fuser -k "$dev" 2>/dev/null || true
  fi
done

# Clean up any stale Fast-DDS shared memory files
rm -f /dev/shm/fastrtps* /dev/shm/sem.fastrtps* 2>/dev/null || true

source /opt/ros/jazzy/setup.bash
source /home/rqsmartev/ros_extra_setup.bash
source /home/rqsmartev/ev_ws/install/setup.bash

exec ros2 launch ev_bringup system_web.launch.py "$@"

