/**
 * FleetPulse - Live Telemetry & GPS Simulation Engine
 */

class TelemetrySimulator {
  constructor(fleet, geofences, onUpdateCallback, onAlertCallback) {
    this.fleet = fleet;
    this.geofences = geofences;
    this.onUpdate = onUpdateCallback;
    this.onAlert = onAlertCallback;
    this.isRunning = false;
    this.speedMultiplier = 2;
    this.timer = null;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timer = setInterval(() => this.tick(), 1000 / this.speedMultiplier);
  }

  pause() {
    this.isRunning = false;
    if (this.timer) clearInterval(this.timer);
  }

  setSpeed(multiplier) {
    this.speedMultiplier = multiplier;
    if (this.isRunning) {
      this.pause();
      this.start();
    }
  }

  tick() {
    this.fleet.forEach(vehicle => {
      if (vehicle.status === 'offline') return;

      // Update location along route
      if (vehicle.status === 'active' || vehicle.status === 'alert') {
        this.moveVehicle(vehicle);
      }

      // Fluctuate telemetry parameters
      this.updateTelemetry(vehicle);

      // Check geofences and alerts
      this.checkAlertConditions(vehicle);
    });

    if (this.onUpdate) {
      this.onUpdate(this.fleet);
    }
  }

  moveVehicle(vehicle) {
    if (!vehicle.route || vehicle.route.length < 2) return;

    const currentWaypoint = vehicle.route[vehicle.routeIndex];
    const nextIndex = (vehicle.routeIndex + 1) % vehicle.route.length;
    const nextWaypoint = vehicle.route[nextIndex];

    // Linear interpolation step towards next waypoint
    const stepSize = 0.05; // speed factor
    const dLat = (nextWaypoint[0] - currentWaypoint[0]) * stepSize;
    const dLng = (nextWaypoint[1] - currentWaypoint[1]) * stepSize;

    vehicle.telemetry.lat += dLat;
    vehicle.telemetry.lng += dLng;

    // Calculate heading angle in degrees
    const heading = Math.atan2(dLng, dLat) * (180 / Math.PI);
    vehicle.telemetry.heading = (heading + 360) % 360;

    // Record trail history (keep last 30 points)
    vehicle.history.push([vehicle.telemetry.lat, vehicle.telemetry.lng]);
    if (vehicle.history.length > 30) {
      vehicle.history.shift();
    }

    // Check if reached waypoint
    const distToNext = Math.hypot(
      nextWaypoint[0] - vehicle.telemetry.lat,
      nextWaypoint[1] - vehicle.telemetry.lng
    );

    if (distToNext < 0.002) {
      vehicle.routeIndex = nextIndex;
      // Random state toggle (e.g. brief stop)
      if (Math.random() < 0.15) {
        vehicle.status = 'idle';
        vehicle.telemetry.speed = 0;
        setTimeout(() => {
          if (vehicle.status === 'idle') vehicle.status = 'active';
        }, 5000);
      }
    }
  }

  updateTelemetry(vehicle) {
    if (vehicle.status === 'active') {
      // Fluctuate speed slightly around 40-70 km/h
      vehicle.telemetry.speed = Math.min(100, Math.max(25, vehicle.telemetry.speed + (Math.random() * 6 - 3)));
      // Slow fuel consumption
      vehicle.telemetry.fuel = Math.max(5, vehicle.telemetry.fuel - 0.02);
      // Small odometer increment
      vehicle.telemetry.odometer += (vehicle.telemetry.speed / 3600);
    } else if (vehicle.status === 'idle') {
      vehicle.telemetry.speed = 0;
    }

    // Engine temperature fluctuation
    vehicle.telemetry.temp = Math.min(115, Math.max(75, vehicle.telemetry.temp + (Math.random() * 2 - 1)));
  }

  checkAlertConditions(vehicle) {
    // 1. Speeding Alert (> 80 km/h)
    if (vehicle.telemetry.speed > 80 && vehicle.status !== 'alert') {
      vehicle.status = 'alert';
      if (this.onAlert) {
        this.onAlert({
          type: 'speed',
          vehicleId: vehicle.id,
          title: `Alerta de Exceso de Velocidad`,
          message: `${vehicle.id} (${vehicle.driver.name}) circulando a ${Math.round(vehicle.telemetry.speed)} km/h`
        });
      }
    } else if (vehicle.telemetry.speed <= 80 && vehicle.status === 'alert' && vehicle.telemetry.fuel > 15) {
      vehicle.status = 'active';
    }

    // 2. Low Fuel Alert (< 15%)
    if (vehicle.telemetry.fuel < 15 && !vehicle.hasLowFuelAlertSent) {
      vehicle.hasLowFuelAlertSent = true;
      if (this.onAlert) {
        this.onAlert({
          type: 'fuel',
          vehicleId: vehicle.id,
          title: `Nivel Bajo de Combustible`,
          message: `${vehicle.id} tiene solo ${Math.round(vehicle.telemetry.fuel)}% de combustible restante`
        });
      }
    }

    // 3. Geofence Boundary Check
    this.geofences.forEach(geo => {
      const distanceMeters = this.calculateDistance(
        vehicle.telemetry.lat,
        vehicle.telemetry.lng,
        geo.lat,
        geo.lng
      );

      const inside = distanceMeters <= geo.radius;
      const insideKey = `inside_${geo.id}`;

      if (inside && !vehicle[insideKey]) {
        vehicle[insideKey] = true;
        if (this.onAlert) {
          this.onAlert({
            type: 'geofence_entry',
            vehicleId: vehicle.id,
            title: `Entrada a Geocerca`,
            message: `${vehicle.id} ingresó a "${geo.name}"`
          });
        }
      } else if (!inside && vehicle[insideKey]) {
        vehicle[insideKey] = false;
        if (this.onAlert) {
          this.onAlert({
            type: 'geofence_exit',
            vehicleId: vehicle.id,
            title: `Salida de Geocerca`,
            message: `${vehicle.id} salió de "${geo.name}"`
          });
        }
      }
    });
  }

  // Haversine formula to compute distance in meters
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }
}
