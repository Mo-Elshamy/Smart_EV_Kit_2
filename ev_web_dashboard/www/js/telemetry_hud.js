/**
 * Smart EV Buggy - GPS Map & Telemetry HUD Module
 * Renders interactive Leaflet.js GPS map, vehicle heading cone, and artificial horizon
 */

const TelemetryHUD = {
  map: null,
  vehicleMarker: null,
  trailPolyline: null,
  gpsTrail: [],
  hasGpsFix: false,
  followVehicle: true,
  lastLat: 0,
  lastLon: 0,
  headingDeg: 0,

  init() {
    this.initMap();
    this.bindEvents();
    this.bindROS();
  },

  initMap() {
    const mapContainer = document.getElementById('leaflet-gps-map');
    if (!mapContainer || typeof L === 'undefined') {
      console.warn('[TelemetryHUD] Leaflet.js not loaded, GPS map unavailable');
      return;
    }

    // Default coordinates: (0,0) or last known location
    this.map = L.map('leaflet-gps-map', {
      center: [25.0, 55.0], // Initial fallback
      zoom: 16,
      zoomControl: true,
      attributionControl: false
    });

    // Dark-mode themed CartoDB / OSM tiles with offline fallback
    const tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    });
    tileLayer.addTo(this.map);

    // Breadcrumb trail polyline
    this.trailPolyline = L.polyline([], {
      color: '#00f5d4',
      weight: 3,
      opacity: 0.85
    }).addTo(this.map);

    // Custom Vehicle Icon with Directional Cone
    const vehicleIcon = L.divIcon({
      className: 'vehicle-leaflet-marker',
      html: `
        <div id="gps-vehicle-cone" class="gps-marker-cone">
          <svg viewBox="0 0 40 40" width="36" height="36">
            <polygon points="20,2 34,36 20,28 6,36" fill="#38bdf8" stroke="#0284c7" stroke-width="2"/>
            <circle cx="20" cy="22" r="4" fill="#f59e0b"/>
          </svg>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    this.vehicleMarker = L.marker([25.0, 55.0], { icon: vehicleIcon }).addTo(this.map);
  },

  bindEvents() {
    const btnCenter = document.getElementById('btn-gps-center');
    if (btnCenter) {
      btnCenter.addEventListener('click', () => {
        if (this.hasGpsFix && this.map) {
          this.map.panTo([this.lastLat, this.lastLon]);
          this.followVehicle = true;
        }
      });
    }

    const btnClearTrail = document.getElementById('btn-gps-clear');
    if (btnClearTrail) {
      btnClearTrail.addEventListener('click', () => {
        this.gpsTrail = [];
        if (this.trailPolyline) {
          this.trailPolyline.setLatLngs([]);
        }
      });
    }

    if (this.map) {
      this.map.on('dragstart', () => {
        this.followVehicle = false;
      });
    }
  },

  bindROS() {
    if (!window.ROSBridge) return;

    // 1. Process GPS (/fix)
    window.ROSBridge.on('gps', (msg) => {
      if (!msg || (msg.latitude === 0 && msg.longitude === 0)) return;

      const lat = msg.latitude;
      const lon = msg.longitude;
      const alt = msg.altitude;
      const status = msg.status ? msg.status.status : -1;

      this.lastLat = lat;
      this.lastLon = lon;
      this.hasGpsFix = status >= 0;

      // Update Leaflet marker
      if (this.vehicleMarker) {
        this.vehicleMarker.setLatLng([lat, lon]);
      }

      // Add to GPS trail
      const lastPt = this.gpsTrail[this.gpsTrail.length - 1];
      if (!lastPt || Math.hypot(lastPt[0] - lat, lastPt[1] - lon) > 0.00002) {
        this.gpsTrail.push([lat, lon]);
        if (this.trailPolyline) {
          this.trailPolyline.setLatLngs(this.gpsTrail);
        }
      }

      if (this.followVehicle && this.map) {
        this.map.setView([lat, lon], this.map.getZoom(), { animate: true });
      }

      // Update GPS HUD Overlay
      const latEl = document.getElementById('hud-gps-lat');
      const lonEl = document.getElementById('hud-gps-lon');
      const altEl = document.getElementById('hud-gps-alt');
      const fixEl = document.getElementById('hud-gps-status');

      if (latEl) latEl.textContent = lat.toFixed(6) + '°';
      if (lonEl) lonEl.textContent = lon.toFixed(6) + '°';
      if (altEl) altEl.textContent = alt.toFixed(1) + ' m';
      if (fixEl) {
        fixEl.textContent = this.hasGpsFix ? '3D FIX' : 'NO FIX';
        fixEl.className = this.hasGpsFix ? 'badge-fix-ok' : 'badge-fix-none';
      }
    });

    // 2. Process IMU for Heading Cone & Artificial Horizon (/imu/data)
    window.ROSBridge.on('imu', (msg) => {
      const q = msg.orientation;
      const sinr_cosp = 2 * (q.w * q.x + q.y * q.z);
      const cosr_cosp = 1 - 2 * (q.x * q.x + q.y * q.y);
      const roll = Math.atan2(sinr_cosp, cosr_cosp) * (180 / Math.PI);

      const sinp = 2 * (q.w * q.y - q.z * q.x);
      const pitch = Math.asin(Math.max(-1, Math.min(1, sinp))) * (180 / Math.PI);

      const siny_cosp = 2 * (q.w * q.z + q.x * q.y);
      const cosy_cosp = 1 - 2 * (q.y * q.y + q.z * q.z);
      let yaw = Math.atan2(siny_cosp, cosy_cosp) * (180 / Math.PI);
      if (yaw < 0) yaw += 360;

      this.headingDeg = yaw;

      // Rotate GPS marker cone
      const coneEl = document.getElementById('gps-vehicle-cone');
      if (coneEl) {
        coneEl.style.transform = `rotate(${yaw}deg)`;
      }

      // Update Artificial Horizon Widget
      const horizonLine = document.getElementById('horizon-line');
      if (horizonLine) {
        const pitchOffset = Math.max(-30, Math.min(30, pitch)) * 1.5;
        horizonLine.style.transform = `translateY(${pitchOffset}px) rotate(${-roll}deg)`;
      }

      // Update Compass Rose Widget
      const compassDisc = document.getElementById('compass-rose');
      if (compassDisc) {
        compassDisc.style.transform = `rotate(${-yaw}deg)`;
      }
    });
  }
};

window.TelemetryHUD = TelemetryHUD;
