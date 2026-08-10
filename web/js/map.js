/**
 * FleetPulse - Leaflet Map Integration & Spatial Overlays
 */

class FleetMapManager {
  constructor(containerId, onVehicleSelectCallback) {
    this.containerId = containerId;
    this.onVehicleSelect = onVehicleSelectCallback;
    this.map = null;
    this.markers = new Map();
    this.trailLines = new Map();
    this.geofenceLayers = new Map();
    this.showTrails = true;
    this.showGeofences = true;

    this.stopPickingCallback = null;
    this.stopMarkers = [];
    this.routeLine = null;

    this.initMap();
  }

  initMap() {
    // Default center: Lima, Perú (-12.046374, -77.042793)
    this.map = L.map(this.containerId, {
      center: [-12.080000, -77.030000],
      zoom: 12,
      zoomControl: false
    });

    // Dark Matter CartoDB Basemap Tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map);

    // Zoom control at bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    this.map.on('click', (e) => {
      if (this.stopPickingCallback) {
        this.stopPickingCallback(e.latlng.lat, e.latlng.lng);
      }
    });
  }

  // ------------------------------------------------------------
  // Route assignment: click-to-add-stop mode + OSRM route rendering
  // ------------------------------------------------------------

  startStopPicking(onStopAdded) {
    this.stopPickingCallback = onStopAdded;
    const container = this.map.getContainer();
    if (container) container.style.cursor = 'crosshair';
  }

  stopStopPicking() {
    this.stopPickingCallback = null;
    const container = this.map.getContainer();
    if (container) container.style.cursor = '';
  }

  renderStopMarkers(stops) {
    this.stopMarkers.forEach(m => this.map.removeLayer(m));
    this.stopMarkers = [];

    stops.forEach((stop, index) => {
      const icon = L.divIcon({
        className: 'stop-marker-icon',
        html: `<div class="stop-pin">${index + 1}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });
      const marker = L.marker([stop.lat, stop.lng], { icon }).addTo(this.map);
      marker.bindTooltip(stop.label || `Parada ${index + 1}`, { direction: 'top' });
      this.stopMarkers.push(marker);
    });
  }

  clearStopMarkers() {
    this.stopMarkers.forEach(m => this.map.removeLayer(m));
    this.stopMarkers = [];
  }

  drawRouteLine(coordsLatLng) {
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = null;
    }
    if (!coordsLatLng || coordsLatLng.length < 2) return;

    this.routeLine = L.polyline(coordsLatLng, {
      color: '#f59e0b',
      weight: 4,
      opacity: 0.85
    }).addTo(this.map);
  }

  clearRouteLine() {
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
      this.routeLine = null;
    }
  }

  updateFleetMarkers(fleet) {
    fleet.forEach(vehicle => {
      const lat = vehicle.telemetry?.lat;
      const lng = vehicle.telemetry?.lng;

      // Vehicles that haven't sent a GPS fix yet (e.g. profile just created) have no
      // coordinates — skip placing/moving a marker for them until the first ping arrives.
      if (lat == null || lng == null) return;

      const latLng = [lat, lng];

      // Update or create Marker
      if (this.markers.has(vehicle.id)) {
        const marker = this.markers.get(vehicle.id);
        marker.setLatLng(latLng);

        // Update Marker Pin HTML class if status changed
        const pinEl = marker.getElement()?.querySelector('.marker-pin');
        if (pinEl) {
          pinEl.className = `marker-pin ${vehicle.status}`;
        }
      } else {
        const marker = this.createVehicleMarker(vehicle);
        marker.addTo(this.map);
        this.markers.set(vehicle.id, marker);
      }

      // Update Trail Polylines
      const history = vehicle.history || [];
      if (this.showTrails && history.length > 1) {
        if (this.trailLines.has(vehicle.id)) {
          this.trailLines.get(vehicle.id).setLatLngs(history);
        } else {
          const trailColor = vehicle.type === 'truck' ? '#06b6d4' : (vehicle.type === 'van' ? '#3b82f6' : '#8b5cf6');
          const polyline = L.polyline(history, {
            color: trailColor,
            weight: 3,
            opacity: 0.7,
            dashArray: '5, 8'
          }).addTo(this.map);
          this.trailLines.set(vehicle.id, polyline);
        }
      }
    });
  }

  createVehicleMarker(vehicle) {
    const iconClass = vehicle.type === 'truck' ? 'fa-truck-front' : (vehicle.type === 'van' ? 'fa-van-shuttle' : 'fa-car');
    
    const customIcon = L.divIcon({
      className: 'vehicle-marker-icon',
      html: `
        <div class="marker-pin ${vehicle.status}">
          <i class="fa-solid ${iconClass}"></i>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    const marker = L.marker([vehicle.telemetry.lat, vehicle.telemetry.lng], { icon: customIcon });

    // Popup content
    const driverName = vehicle.driver?.name || 'Sin asignar';
    const speed = vehicle.telemetry?.speed;
    const fuel = vehicle.telemetry?.fuel;
    const popupContent = `
      <div class="popup-card">
        <div class="popup-title">${vehicle.id} - ${vehicle.name || ''}</div>
        <div class="popup-row">
          <span>Chofer:</span>
          <strong>${driverName}</strong>
        </div>
        <div class="popup-row">
          <span>Velocidad:</span>
          <strong>${speed != null ? Math.round(speed) : '—'} km/h</strong>
        </div>
        <div class="popup-row">
          <span>Combustible:</span>
          <strong>${fuel != null ? Math.round(fuel) : '—'}%</strong>
        </div>
      </div>
    `;

    marker.bindPopup(popupContent, {
      className: 'custom-leaflet-popup',
      closeButton: false
    });

    marker.on('click', () => {
      if (this.onVehicleSelect) {
        this.onVehicleSelect(vehicle.id);
      }
    });

    return marker;
  }

  renderGeofences(geofences) {
    // Clear existing geofence layers
    this.geofenceLayers.forEach(layer => this.map.removeLayer(layer));
    this.geofenceLayers.clear();

    if (!this.showGeofences) return;

    geofences.forEach(geo => {
      const circle = L.circle([geo.lat, geo.lng], {
        color: geo.color || '#3b82f6',
        fillColor: geo.color || '#3b82f6',
        fillOpacity: 0.15,
        radius: geo.radius,
        weight: 2,
        dashArray: '4, 6'
      });

      circle.bindTooltip(`<b>${geo.name}</b><br>Radio: ${geo.radius}m`, {
        permanent: false,
        direction: 'top',
        className: 'custom-leaflet-popup'
      });

      circle.addTo(this.map);
      this.geofenceLayers.set(geo.id, circle);
    });
  }

  centerOnVehicle(vehicle) {
    if (!vehicle || vehicle.telemetry?.lat == null || vehicle.telemetry?.lng == null) return;
    this.map.flyTo([vehicle.telemetry.lat, vehicle.telemetry.lng], 15, {
      duration: 1.2
    });

    const marker = this.markers.get(vehicle.id);
    if (marker) {
      marker.openPopup();
    }
  }

  fitFleetBounds(fleet) {
    if (!fleet) return;
    const bounds = fleet
      .filter(v => v.telemetry?.lat != null && v.telemetry?.lng != null)
      .map(v => [v.telemetry.lat, v.telemetry.lng]);
    if (bounds.length === 0) return;
    this.map.fitBounds(bounds, { padding: [50, 50] });
  }

  toggleTrails(show) {
    this.showTrails = show;
    this.trailLines.forEach(line => {
      if (show) line.addTo(this.map);
      else this.map.removeLayer(line);
    });
  }

  toggleGeofences(show) {
    this.showGeofences = show;
    this.geofenceLayers.forEach(layer => {
      if (show) layer.addTo(this.map);
      else this.map.removeLayer(layer);
    });
  }
}
