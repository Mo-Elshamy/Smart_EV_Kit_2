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

  // Primary topics from Stage 4
  const rgbTopic = '/zed/zed_node/rgb/color/rect/image';
  const depthTopic = '/zed/zed_node/image/depth_image';

  const rgbImg = document.getElementById('camera-stream-rgb');
  const depthImg = document.getElementById('camera-stream-depth');

  if (rgbImg) {
    rgbImg.src = `http://${host}:${videoPort}/stream?topic=${rgbTopic}&type=mjpeg&width=640&height=360`;
    rgbImg.onerror = () => {
      console.warn('[Video] RGB stream reconnecting...');
      setTimeout(() => {
        rgbImg.src = `http://${host}:${videoPort}/stream?topic=${rgbTopic}&type=mjpeg&width=640&height=360&t=${Date.now()}`;
      }, 3000);
    };
  }

  if (depthImg) {
    depthImg.src = `http://${host}:${videoPort}/stream?topic=${depthTopic}&type=mjpeg&width=640&height=360`;
    depthImg.onerror = () => {
      console.warn('[Video] Depth stream reconnecting...');
      setTimeout(() => {
        depthImg.src = `http://${host}:${videoPort}/stream?topic=${depthTopic}&type=mjpeg&width=640&height=360&t=${Date.now()}`;
      }, 3000);
    };
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
        }
        if (window.TelemetryHUD && window.TelemetryHUD.map) {
          window.TelemetryHUD.map.invalidateSize();
        }
      }, 100);
    });
  });
}
