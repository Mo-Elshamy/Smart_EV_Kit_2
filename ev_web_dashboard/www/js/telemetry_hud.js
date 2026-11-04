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
  firstFixOccurred: false,
  followVehicle: true,
  defaultLat: 25.322608093519516,
  defaultLon: 55.48792024091055,
  lastLat: 25.322608093519516,
  lastLon: 55.48792024091055,
  headingDeg: 0,

  init() {
    this.initMap();
    this.initStandbyDisplay();
    this.bindEvents();
    this.bindROS();
  },

  initStandbyDisplay() {
    const latEl = document.getElementById('hud-gps-lat');
    const lonEl = document.getElementById('hud-gps-lon');
    const altEl = document.getElementById('hud-gps-alt');
    const fixEl = document.getElementById('hud-gps-status');

    if (latEl) latEl.textContent = `${this.defaultLat.toFixed(6)}° (Standby)`;
    if (lonEl) lonEl.textContent = `${this.defaultLon.toFixed(6)}° (Standby)`;
    if (altEl) altEl.textContent = '--.- m';
    if (fixEl) {
      fixEl.textContent = 'NO FIX (STANDBY)';
      fixEl.className = 'badge-fix-none';
    }
  },

  initMap() {
    const mapContainer = document.getElementById('leaflet-gps-map');
    if (!mapContainer || typeof L === 'undefined') {
      console.warn('[TelemetryHUD] Leaflet.js not loaded, GPS map unavailable');
      return;
    }

    // Default standby coordinates when GPS has no signal
    this.map = L.map('leaflet-gps-map', {
      center: [this.defaultLat, this.defaultLon],
      zoom: 17,
      zoomControl: true,
      attributionControl: false
    });

    // 1. High-Resolution Satellite Aerial Basemap (Esri World Imagery)
    const satelliteTiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '&copy; Esri World Imagery'
    });

    // 2. Google Satellite with Hybrid Labels (Roads, Buildings, Landmarks)
    const googleSatTiles = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      attribution: '&copy; Google'
    });

    // 3. OpenStreetMap Standard Streets
    const streetTiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    });

    // 4. Dark Gray Canvas (Esri Dark Canvas)
    const darkTiles = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: '&copy; Esri Dark Canvas'
    });

    // Add Satellite Aerial by default (Full natural color satellite view)
    googleSatTiles.addTo(this.map);

    // Layer switcher control (Top-right pill)
    const baseLayers = {
      "🛰️ Google Satellite": googleSatTiles,
      "🌍 Esri Satellite": satelliteTiles,
      "🗺️ Road Streets": streetTiles,
      "🌙 Dark Canvas": darkTiles
    };
    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(this.map);

    // Breadcrumb trail polyline - Vivid Cyan / White on Colored Satellite
    this.trailPolyline = L.polyline([], {
      color: '#00e5ff',
      weight: 4,
      opacity: 0.95
    }).addTo(this.map);

    // Custom Vehicle Icon with Directional Cone - High Contrast
    const vehicleIcon = L.divIcon({
      className: 'vehicle-leaflet-marker',
      html: `
        <div id="gps-vehicle-cone" class="gps-marker-cone">
          <svg viewBox="0 0 40 40" width="38" height="38">
            <polygon points="20,2 34,36 20,28 6,36" fill="#ffffff" stroke="#000000" stroke-width="2.5"/>
            <circle cx="20" cy="22" r="4.5" fill="#ef4444" stroke="#000000" stroke-width="1.5"/>
          </svg>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    this.vehicleMarker = L.marker([this.defaultLat, this.defaultLon], { icon: vehicleIcon }).addTo(this.map);
  },

  bindEvents() {
    const btnCenter = document.getElementById('btn-gps-center');
    if (btnCenter) {
      btnCenter.addEventListener('click', () => {
        if (this.map) {
          const lat = this.hasGpsFix ? this.lastLat : this.defaultLat;
          const lon = this.hasGpsFix ? this.lastLon : this.defaultLon;
          this.map.panTo([lat, lon]);
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

    const btnSim = document.getElementById('btn-gps-sim');
    if (btnSim) {
      btnSim.addEventListener('click', () => {
        this.simulateIndoorFix();
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
      if (!msg) return;

      this.packetCount = (this.packetCount || 0) + 1;
      const status = msg.status ? msg.status.status : -1;
      const lat = typeof msg.latitude === 'number' ? msg.latitude : parseFloat(msg.latitude);
      const lon = typeof msg.longitude === 'number' ? msg.longitude : parseFloat(msg.longitude);
      const alt = typeof msg.altitude === 'number' ? msg.altitude : parseFloat(msg.altitude);

      const isValidCoords = isFinite(lat) && isFinite(lon) && !isNaN(lat) && !isNaN(lon) && (lat !== 0 || lon !== 0);
      this.hasGpsFix = (status >= 0) && isValidCoords;

      const latEl = document.getElementById('hud-gps-lat');
      const lonEl = document.getElementById('hud-gps-lon');
      const altEl = document.getElementById('hud-gps-alt');
      const fixEl = document.getElementById('hud-gps-status');
      const streamEl = document.getElementById('hud-gps-stream');
      const packetsEl = document.getElementById('hud-gps-packets');
      const noteEl = document.getElementById('hud-gps-note');

      if (streamEl) {
        streamEl.textContent = '🟢 Active Stream';
        streamEl.style.color = '#10b981';
      }
      if (packetsEl) {
        packetsEl.textContent = `${this.packetCount} pkts received`;
      }

      if (fixEl) {
        fixEl.textContent = this.hasGpsFix ? (status === 0 ? '3D FIX (OUTDOORS)' : 'RTK FIX') : 'NO FIX (INDOORS)';
        fixEl.className = this.hasGpsFix ? 'badge-fix-ok' : 'badge-fix-none';
      }

      if (this.hasGpsFix) {
        this.lastLat = lat;
        this.lastLon = lon;

        if (latEl) latEl.textContent = lat.toFixed(6) + '°';
        if (lonEl) lonEl.textContent = lon.toFixed(6) + '°';
        if (altEl && isFinite(alt)) altEl.textContent = alt.toFixed(1) + ' m';
        if (noteEl) noteEl.style.display = 'none';

        // Override vehicle marker position with live GPS coordinates
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
          if (!this.firstFixOccurred) {
            this.firstFixOccurred = true;
            this.map.setView([lat, lon], 18, { animate: true });
          } else {
            this.map.setView([lat, lon], this.map.getZoom(), { animate: true });
          }
        }
      } else {
        // No fix: If real fix hasn't occurred yet, display the default standby coordinates
        if (!this.firstFixOccurred) {
          if (latEl) latEl.textContent = `${this.defaultLat.toFixed(6)}° (Standby)`;
          if (lonEl) lonEl.textContent = `${this.defaultLon.toFixed(6)}° (Standby)`;
          if (this.vehicleMarker) {
            this.vehicleMarker.setLatLng([this.defaultLat, this.defaultLon]);
          }
        } else {
          if (latEl) latEl.textContent = `${this.lastLat.toFixed(6)}° (Lost)`;
          if (lonEl) lonEl.textContent = `${this.lastLon.toFixed(6)}° (Lost)`;
        }
        if (altEl) altEl.textContent = '--.- m';
        if (noteEl) noteEl.style.display = 'block';
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
  },

  simBaseLat: 25.322608093519516,
  simBaseLon: 55.48792024091055,
  simStep: 0,

  simulateIndoorFix() {
    this.simStep++;
    // Advance coordinates along a smooth circular path for visual testing
    const angle = this.simStep * 0.35;
    const offsetLat = Math.sin(angle) * 0.0005;
    const offsetLon = Math.cos(angle) * 0.0005;

    const simLat = this.simBaseLat + offsetLat;
    const simLon = this.simBaseLon + offsetLon;
    const simAlt = 16.5;

    const mockMsg = {
      status: { status: 0, service: 1 },
      latitude: simLat,
      longitude: simLon,
      altitude: simAlt
    };

    if (window.ROSBridge && window.ROSBridge.notifyListeners) {
      window.ROSBridge.notifyListeners('gps', mockMsg);
    }

    if (this.map) {
      this.map.setView([simLat, simLon], 18, { animate: true });
    }
  }
};

window.TelemetryHUD = TelemetryHUD;
