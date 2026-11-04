#!/usr/bin/env bash
set -e

echo "=== [1/4] Ensuring Kernel Driver Auto-load on Boot ==="
echo "ch341" | tee /etc/modules-load.d/ch341.conf > /dev/null
modprobe ch341 2>/dev/null || true

echo "=== [2/4] Installing Permanent Udev Rules for All EV Rig Sensors ==="
usermod -aG dialout,video,plugdev rqsmartev || true

# LiDAR: Slamtec RPLIDAR S3 (CP2102 10c4:ea60)
echo "[LiDAR] Setting up /dev/ttyLIDAR (10c4:ea60)..."
echo 'KERNEL=="ttyUSB*", ATTRS{idVendor}=="10c4", ATTRS{idProduct}=="ea60", MODE:="0777", SYMLINK+="rplidar", SYMLINK+="ttyLIDAR", ENV{ID_MM_DEVICE_IGNORE}="1"' | tee /etc/udev/rules.d/99-rplidar.rules > /dev/null

# GNSS: Holybro M9N (FTDI 0403:6015)
echo "[GPS] Setting up /dev/ttyGPS (0403:6015)..."
echo 'KERNEL=="ttyUSB*|ttyACM*", ATTRS{idVendor}=="0403", ATTRS{idProduct}=="6015", MODE:="0777", SYMLINK+="ttyGPS", ENV{ID_MM_DEVICE_IGNORE}="1"' | tee /etc/udev/rules.d/99-holybro.rules > /dev/null

# IMU: WitMotion WT901 (CH340 1a86:7523)
echo "[IMU] Setting up /dev/ttyIMU (1a86:7523)..."
echo 'KERNEL=="ttyUSB*", ATTRS{idVendor}=="1a86", ATTRS{idProduct}=="7523", MODE:="0777", SYMLINK+="ttyIMU", ENV{ID_MM_DEVICE_IGNORE}="1"' | tee /etc/udev/rules.d/99-witmotion.rules > /dev/null

# Reload and apply udev rules
udevadm control --reload-rules
udevadm trigger

# Immediate permissions fallback
chmod 666 /dev/ttyUSB* /dev/video* 2>/dev/null || true

echo "=== [3/4] Permanent Device Symlinks Configured ==="
ls -la /dev/ttyLIDAR /dev/ttyGPS /dev/ttyIMU 2>/dev/null || true

echo "=== [4/4] Setting up systemd Autostart Service on Power-Up ==="
cat << 'EOF' | tee /etc/systemd/system/smart_ev.service > /dev/null
[Unit]
Description=Smart EV Buggy Autonomous System & Web Command Center
After=network.target systemd-udevd.service
Wants=network.target

[Service]
Type=simple
User=rqsmartev
Group=rqsmartev
WorkingDirectory=/home/rqsmartev/ev_ws
ExecStart=/home/rqsmartev/launch_system_web.sh
Restart=on-failure
RestartSec=5s
KillMode=mixed
TimeoutStopSec=10s
Environment="HOME=/home/rqsmartev"
Environment="USER=rqsmartev"

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable smart_ev.service

echo ""
echo "=================================================================="
echo " SUCCESS! All USB sensors and boot autostart configured."
echo " The system will now launch automatically on Jetson power-up!"
echo ""
echo " Useful management commands:"
echo "   Start now:    sudo systemctl start smart_ev.service"
echo "   Check status: sudo systemctl status smart_ev.service"
echo "   View logs:    journalctl -u smart_ev.service -f"
echo "   Stop:         sudo systemctl stop smart_ev.service"
echo "   Disable boot: sudo systemctl disable smart_ev.service"
echo "=================================================================="

