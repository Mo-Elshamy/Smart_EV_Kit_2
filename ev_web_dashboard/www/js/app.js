/**
 * Smart EV Buggy - Master Web Command Center Controller
 * Manages video feeds, mobile tab switching, and component lifecycles
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[App] Initializing Smart EV Command Center...');

  // 1. Setup Camera Feeds (:8080 MJPEG streams with dynamic host)
  setupVideoFeeds();

  // 2. Initialize ROSBridge
  if (window.ROSBridge) {
    window.ROSBridge.init();
  }

  // 3. Initialize Mapping Visualizer (2D SLAM + 3D Three.js)
  if (window.MapRenderer) {
    window.MapRenderer.init();
  }

  // 4. Initialize GPS Map & Telemetry HUD
  if (window.TelemetryHUD) {
    window.TelemetryHUD.init();
  }

  // 5. Setup Responsive Mobile Tab Switcher
  setupMobileNavigation();
});

function setupVideoFeeds() {
  const host = window.location.hostname || 'localhost';
  const videoPort = 8080;

  // Primary topics from Stage 4 (using ros_compressed for zero Jetson CPU overhead)
  const rgbTopic = '/zed/zed_node/rgb/color/rect/image';
  const depthTopic = '/zed/zed_node/image/depth_image';

  const rgbImg = document.getElementById('camera-stream-rgb');
  const depthImg = document.getElementById('camera-stream-depth');
  const rgbSpinner = document.getElementById('spinner-camera-rgb');
  const depthSpinner = document.getElementById('spinner-camera-depth');

  const rgbUrl = `http://${host}:${videoPort}/stream?topic=${rgbTopic}&type=ros_compressed`;
  const depthUrl = `http://${host}:${videoPort}/stream?topic=${depthTopic}&type=ros_compressed`;

  if (rgbImg) {
    rgbImg.onload = () => {
      if (rgbSpinner) rgbSpinner.style.display = 'none';
    };
    rgbImg.onerror = () => {
      console.warn('[Video] RGB stream reconnecting...');
      if (rgbSpinner) {
        rgbSpinner.style.display = 'flex';
        const txt = rgbSpinner.querySelector('.spinner-text');
        if (txt) txt.textContent = 'Reconnecting RGB Feed...';
      }
      setTimeout(() => {
        rgbImg.src = `${rgbUrl}&t=${Date.now()}`;
      }, 2000);
    };
    rgbImg.src = rgbUrl;
  }

  if (depthImg) {
    depthImg.onload = () => {
      if (depthSpinner) depthSpinner.style.display = 'none';
    };
    depthImg.onerror = () => {
      console.warn('[Video] Depth stream reconnecting...');
      if (depthSpinner) {
        depthSpinner.style.display = 'flex';
        const txt = depthSpinner.querySelector('.spinner-text');
        if (txt) txt.textContent = 'Reconnecting Depth Feed...';
      }
      setTimeout(() => {
        depthImg.src = `${depthUrl}&t=${Date.now()}`;
      }, 2000);
    };
    depthImg.src = depthUrl;
  }
}

function setupMobileNavigation() {
  const tabs = document.querySelectorAll('.mobile-nav-btn');
  const modules = document.querySelectorAll('.dashboard-module');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetModuleId = tab.getAttribute('data-target');

      // Update active tab buttons
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      // Update visible module on mobile
      modules.forEach((mod) => {
        if (mod.id === targetModuleId) {
          mod.classList.add('active-module-mobile');
        } else {
          mod.classList.remove('active-module-mobile');
        }
      });

      // Trigger resize for canvases and Leaflet map upon tab switch
      setTimeout(() => {
        if (window.MapRenderer) {
          window.MapRenderer.resize2D();
          window.MapRenderer.resize3D();
        }
        if (window.TelemetryHUD && window.TelemetryHUD.map) {
          window.TelemetryHUD.map.invalidateSize();
        }
      }, 100);
    });
  });
}
