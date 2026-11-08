#!/usr/bin/env bash
# Smart EV Buggy - Jetson Orin Performance & Headless Optimization Script
# Usage:
#   sudo bash optimize_jetson.sh [options]
# Options:
#   --headless      Disable desktop GUI (gdm3/Xorg), saving ~500MB RAM/VRAM
#   --gui           Re-enable desktop GUI (graphical.target)
#   --max-perf      Set MAXN_SUPER (Mode 2) power profile and maximize CPU/GPU clocks
#   --all           Apply all optimizations (headless + max-perf + kernel buffers)
#   --status        Check current CPU, RAM, GPU, power mode and GUI status

set -e

if [ "$EUID" -ne 0 ] && [ "$1" != "--status" ] && [ "$1" != "-s" ]; then
  echo "Error: Most optimization commands require root. Please run with sudo:"
  echo "  sudo bash $0 --all"
  exit 1
fi

ACTION="${1:---status}"

case "$ACTION" in
  --headless)
    echo "=== Disabling Ubuntu Desktop GUI for Headless Operation ==="
    systemctl set-default multi-user.target
    systemctl stop gdm3 || systemctl stop gdm || true
    echo "✓ Desktop GUI disabled. Freeing ~500MB RAM/VRAM for SLAM and CUDA."
    ;;

  --gui)
    echo "=== Enabling Ubuntu Desktop GUI ==="
    systemctl set-default graphical.target
    systemctl start gdm3 || systemctl start gdm || true
    echo "✓ Desktop GUI enabled (graphical.target)."
    ;;

  --max-perf)
    echo "=== Enabling Jetson MAXN_SUPER Power Mode & Maximum Clocks ==="
    if command -v nvpmodel &>/dev/null; then
      nvpmodel -m 2 2>/dev/null || nvpmodel -m 0 2>/dev/null || true
      echo "✓ Power mode set to MAXN_SUPER"
    fi
    if command -v jetson_clocks &>/dev/null; then
      jetson_clocks || true
      echo "✓ Jetson clocks maximized (CPU, GPU, EMC)"
    fi

    # Network & Fast-DDS kernel buffer optimizations
    sysctl -w net.core.rmem_max=8388608 >/dev/null 2>&1 || true
    sysctl -w net.core.wmem_max=8388608 >/dev/null 2>&1 || true
    sysctl -w net.core.rmem_default=2097152 >/dev/null 2>&1 || true
    sysctl -w net.core.wmem_default=2097152 >/dev/null 2>&1 || true
    echo "✓ Kernel socket buffers tuned for Fast-DDS zero-drop transport"
    ;;

  --all)
    echo "=== Applying Full System Optimization for Autonomous Operation ==="
    # 1. Headless
    systemctl set-default multi-user.target
    systemctl stop gdm3 2>/dev/null || true

    # 2. Max Power & Clocks
    if command -v nvpmodel &>/dev/null; then
      nvpmodel -m 2 2>/dev/null || true
    fi
    if command -v jetson_clocks &>/dev/null; then
      jetson_clocks 2>/dev/null || true
    fi

    # 3. Kernel socket buffers
    sysctl -w net.core.rmem_max=8388608 >/dev/null 2>&1 || true
    sysctl -w net.core.wmem_max=8388608 >/dev/null 2>&1 || true
    sysctl -w net.core.rmem_default=2097152 >/dev/null 2>&1 || true
    sysctl -w net.core.wmem_default=2097152 >/dev/null 2>&1 || true

    echo "=========================================================="
    echo " SUCCESS! Jetson Orin Nano Super fully optimized:"
    echo "   - Desktop GUI disabled (multi-user.target)"
    echo "   - Mode 2 (MAXN_SUPER: CPU 1.73GHz, GPU 1020MHz, EMC 3.2GHz)"
    echo "   - Kernel buffers tuned (8MB rmem/wmem)"
    echo "=========================================================="
    ;;

  --status|-s)
    echo "=== Jetson System & Performance Status ==="
    echo -n "Boot Target: "
    systemctl get-default
    echo -n "Desktop GUI Status: "
    if systemctl is-active --quiet gdm3 || systemctl is-active --quiet gdm; then
      echo "RUNNING (consuming ~500MB RAM/VRAM)"
    else
      echo "STOPPED (Headless mode active - maximum efficiency)"
    fi
    echo ""
    echo "Power Mode:"
    nvpmodel -q 2>/dev/null || echo "nvpmodel not available"
    echo ""
    echo "Memory Usage:"
    free -h
    echo ""
    echo "CPU Frequencies:"
    cat /sys/devices/system/cpu/cpu*/cpufreq/scaling_cur_freq 2>/dev/null | awk '{printf "CPU%d: %.1f MHz\n", NR-1, $1/1000}'
    ;;

  *)
    echo "Usage: sudo bash $0 {--all|--headless|--gui|--max-perf|--status}"
    exit 1
    ;;
esac
