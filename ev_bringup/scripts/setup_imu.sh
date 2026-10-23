#!/usr/bin/env bash
set -e

echo "=== WitMotion WT901 (CH340) Driver & Udev Setup ==="

# 1. Install ch341 kernel module for the current Jetson kernel
KVER=$(uname -r)
MOD_DEST="/lib/modules/${KVER}/kernel/drivers/usb/serial"
MODULE_PATH="/home/qrsmartev/ev_ws/ch341.ko"

if [ ! -f "$MODULE_PATH" ]; then
    echo "Error: $MODULE_PATH not found!"
    exit 1
fi

echo "[1/4] Installing ch341.ko to $MOD_DEST..."
sudo mkdir -p "$MOD_DEST"
sudo cp "$MODULE_PATH" "$MOD_DEST/ch341.ko"
sudo depmod -a

echo "[2/4] Enabling ch341 module to auto-load on system boot..."
echo "ch341" | sudo tee /etc/modules-load.d/ch341.conf > /dev/null

echo "[3/4] Loading ch341 module into running kernel..."
sudo modprobe ch341

echo "[4/4] Creating persistent udev rule for /dev/ttyIMU (1a86:7523)..."
echo 'KERNEL=="ttyUSB*", ATTRS{idVendor}=="1a86", ATTRS{idProduct}=="7523", MODE:="0777", SYMLINK+="ttyIMU", ENV{ID_MM_DEVICE_IGNORE}="1"' | sudo tee /etc/udev/rules.d/99-witmotion.rules > /dev/null

sudo udevadm control --reload-rules
sudo udevadm trigger

echo "=== Done! Verifying port ==="
sleep 1
ls -la /dev/ttyUSB* /dev/ttyIMU 2>/dev/null || echo "Please replug the IMU USB cable if /dev/ttyIMU does not immediately appear."

