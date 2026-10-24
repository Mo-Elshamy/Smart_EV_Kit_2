#!/usr/bin/env bash
set -e

echo "=== Slamtec RPLIDAR S3 (CP2102 10c4:ea60) Udev Setup ==="

echo 'KERNEL=="ttyUSB*", ATTRS{idVendor}=="10c4", ATTRS{idProduct}=="ea60", MODE:="0777", SYMLINK+="rplidar", SYMLINK+="ttyLIDAR"' | sudo tee /etc/udev/rules.d/99-rplidar.rules > /dev/null

sudo udevadm control --reload-rules
sudo udevadm trigger

echo "=== Done! Verifying port ==="
sleep 1
ls -la /dev/ttyLIDAR /dev/rplidar 2>/dev/null || echo "Please replug the LiDAR USB cable if /dev/ttyLIDAR does not immediately appear."

