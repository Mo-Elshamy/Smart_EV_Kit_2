#!/usr/bin/env bash
set -e

echo "=== Holybro M9N GNSS (FTDI 0403:6015) Udev Setup ==="

echo 'KERNEL=="ttyUSB*", ATTRS{idVendor}=="0403", ATTRS{idProduct}=="6015", MODE:="0777", SYMLINK+="ttyGPS"' | sudo tee /etc/udev/rules.d/99-holybro.rules > /dev/null

sudo udevadm control --reload-rules
sudo udevadm trigger

echo "=== Done! Verifying port ==="
sleep 1
ls -la /dev/ttyGPS 2>/dev/null || echo "Please replug the GPS USB cable if /dev/ttyGPS does not immediately appear."
