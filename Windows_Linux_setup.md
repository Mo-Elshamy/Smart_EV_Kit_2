**ROS 2 Jazzy Jalisco** targets **Ubuntu 24.04 (Noble Numbat)**.

---

### Step 1: Install Ubuntu 24.04 via WSL 2 (on Windows)

1. Open **PowerShell** as Administrator on Windows.
2. Install Ubuntu 24.04:
```powershell
wsl --install -d Ubuntu-24.04

```


3. Restart your PC if prompted, then open **Ubuntu 24.04** from your Start Menu and create your username and password.

---

### Step 2: Configure Locale & Repositories

Inside your Ubuntu 24.04 terminal, run:

```bash
# Set locale to UTF-8
sudo apt update && sudo apt install locales -y
sudo locale-gen en_US en_US.UTF-8
sudo update-locale LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8
export LANG=en_US.UTF-8

# Enable Ubuntu Universe repository
sudo apt install software-properties-common curl -y
sudo add-apt-repository universe -y

# Add ROS 2 GPG Key
sudo curl -sSL https://raw.githubusercontent.com/ros/rosdistro/master/ros.key -o /usr/share/keyrings/ros-archive-keyring.gpg

# Add ROS 2 repository to apt sources
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/ros-archive-keyring.gpg] http://packages.ros.org/ros2/ubuntu $(. /etc/os-release && echo $UBUNTU_CODENAME) main" | sudo tee /etc/apt/sources.list.d/ros2.list > /dev/null

```

---

### Step 3: Install ROS 2 Jazzy Desktop

```bash
# Update repository index
sudo apt update

# Install development tools
sudo apt install ros-dev-tools -y

# Install ROS 2 Jazzy Desktop (includes core libraries, RViz 2, and demos)
sudo apt install ros-jazzy-desktop -y

```

---

### Step 4: Configure the Environment

Automatically source ROS 2 Jazzy every time a new terminal is opened:

```bash
echo "source /opt/ros/jazzy/setup.bash" >> ~/.bashrc
source ~/.bashrc

```

---

### Step 5: Verify the Installation

To verify that ROS 2 Jazzy is operating properly:

1. In your current terminal, run the C++ talker demo:
```bash
ros2 run demo_nodes_cpp talker

```


*Expected behavior:* You will see terminal output publishing: `[INFO] [talker]: Publishing: 'Hello World: 1'`, incrementing each second.
2. Open a second Ubuntu terminal and run the Python listener demo:
```bash
ros2 run demo_nodes_py listener

```


*Expected behavior:* The second terminal will output: `[INFO] [listener]: I heard: [Hello World: 1]`.
3. *(Optional GUI Check)* In either terminal, run:
```bash
rviz2

```


*Expected behavior:* The RViz 2 visualization window opens directly on your Windows desktop via WSLg.


