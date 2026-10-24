#!/usr/bin/env bash
set -e

echo "=== WitMotion WT901 (CH340) Driver & Udev Setup ==="

KVER=$(uname -r)
MOD_DEST="/lib/modules/${KVER}/kernel/drivers/usb/serial"

# 1. Check if ch341 module is already available in the kernel
if sudo modprobe ch341 2>/dev/null; then
    echo "[1/3] ch341 kernel module is already available and loaded."
else
    echo "[1/3] ch341 module not found in kernel ${KVER}. Preparing ch341.ko..."
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    if [ -f "${SCRIPT_DIR}/ch341.ko" ]; then
        MODULE_PATH="${SCRIPT_DIR}/ch341.ko"
    elif [ -f "${HOME}/ev_ws/ch341.ko" ]; then
        MODULE_PATH="${HOME}/ev_ws/ch341.ko"
    elif [ -f "/home/qrsmartev/ev_ws/ch341.ko" ]; then
        MODULE_PATH="/home/qrsmartev/ev_ws/ch341.ko"
    else
        echo "Building ch341.ko from Linux kernel source for ${KVER}..."
        sudo apt update
        sudo apt install -y build-essential curl linux-headers-${KVER} || true
        BUILD_DIR=$(mktemp -d /tmp/ch341_build.XXXXXX)
        KMAJ_MIN=$(echo "${KVER}" | cut -d. -f1,2)
        curl -sSL "https://raw.githubusercontent.com/torvalds/linux/v${KMAJ_MIN}/drivers/usb/serial/ch341.c" -o "${BUILD_DIR}/ch341.c"
        cat << 'EOF' > "${BUILD_DIR}/Makefile"
obj-m += ch341.o
all:
	make -C /lib/modules/$(shell uname -r)/build M=$(PWD) modules
EOF
        make -C "${BUILD_DIR}"
        MODULE_PATH="${BUILD_DIR}/ch341.ko"
    fi

    echo "Installing ch341.ko to ${MOD_DEST}..."
    sudo mkdir -p "${MOD_DEST}"
    sudo cp "${MODULE_PATH}" "${MOD_DEST}/ch341.ko"
    sudo depmod -a
    sudo modprobe ch341
fi

echo "[2/3] Enabling ch341 module to auto-load on system boot..."
echo "ch341" | sudo tee /etc/modules-load.d/ch341.conf > /dev/null

echo "[3/3] Creating persistent udev rule for /dev/ttyIMU (1a86:7523)..."
echo 'KERNEL=="ttyUSB*", ATTRS{idVendor}=="1a86", ATTRS{idProduct}=="7523", MODE:="0777", SYMLINK+="ttyIMU"' | sudo tee /etc/udev/rules.d/99-witmotion.rules > /dev/null

sudo udevadm control --reload-rules
sudo udevadm trigger

echo "=== Done! Verifying port ==="
sleep 1
ls -la /dev/ttyUSB* /dev/ttyIMU 2>/dev/null || echo "Please replug the IMU USB cable if /dev/ttyIMU does not immediately appear."
