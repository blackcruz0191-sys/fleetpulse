/**
 * FleetPulse - Dynamic UI Component Rendering
 */

const UIComponents = {
  
  // Render sidebar vehicle list
  renderVehicleList(container, fleet, selectedId, onSelectCallback) {
    if (!container) return;
    
    container.innerHTML = fleet.map(v => {
      const isSelected = v.id === selectedId ? 'selected' : '';
      const iconClass = v.type === 'truck' ? 'fa-truck-front' : (v.type === 'van' ? 'fa-van-shuttle' : 'fa-car');
      const statusText = v.status === 'active' ? 'En Ruta' : (v.status === 'idle' ? 'Detenido' : (v.status === 'alert' ? 'Alerta' : 'Desconectado'));
      const speed = v.telemetry?.speed ?? 0;
      const fuel = v.telemetry?.fuel;
      const battery = v.telemetry?.battery;

      return `
        <div class="vehicle-card ${v.status} ${isSelected}" data-id="${v.id}">
          <div class="card-top">
            <div class="vehicle-id">
              <i class="fa-solid ${iconClass}"></i> ${v.id}
              <span class="vehicle-plate">${v.plate || 'Sin Placa'}</span>
            </div>
            <span class="status-badge ${v.status}">${statusText}</span>
          </div>

          <div class="driver-info">
            <i class="fa-solid fa-user-gear"></i> ${v.driver?.name || 'Sin asignar'}
          </div>

          <div class="card-stats">
            <div class="stat-item">
              <span class="lbl">Velocidad</span>
              <span class="val">${Math.round(speed)} km/h</span>
            </div>
            <div class="stat-item">
              <span class="lbl">Combustible</span>
              <span class="val">${fuel != null ? Math.round(fuel) + '%' : '—'}</span>
            </div>
            <div class="stat-item">
              <span class="lbl">Batería</span>
              <span class="val">${battery != null ? battery + '%' : '—'}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click events
    container.querySelectorAll('.vehicle-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        if (onSelectCallback) onSelectCallback(id);
      });
    });
  },

  // Render detail drawer
  renderVehicleDrawer(container, vehicle) {
    if (!container || !vehicle) return;

    const iconClass = vehicle.type === 'truck' ? 'fa-truck-front' : (vehicle.type === 'van' ? 'fa-van-shuttle' : 'fa-car');
    const driver = vehicle.driver || {};
    const telemetry = vehicle.telemetry || {};
    const avatar = driver.avatar || (driver.name ? driver.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : '—');
    const fmt = (val, digits = 0) => (val != null ? Math.round(val * Math.pow(10, digits)) / Math.pow(10, digits) : '—');

    container.innerHTML = `
      <div class="drawer-header">
        <div class="drawer-vehicle-title">
          <i class="fa-solid ${iconClass}"></i> ${vehicle.id}
        </div>
        <p style="color: var(--text-muted); font-size: 0.85rem;">${vehicle.name || 'Sin modelo asignado'} (${vehicle.plate || 'Sin Placa'})</p>

        <div class="drawer-driver-card">
          <div class="driver-avatar">${avatar}</div>
          <div class="driver-details">
            <h4>${driver.name || 'Chofer no asignado'}</h4>
            <p><i class="fa-solid fa-phone"></i> ${driver.phone || '—'}</p>
            ${driver.license?.number ? `<p style="font-size:0.7rem;"><i class="fa-solid fa-id-card"></i> Brevete ${driver.license.number} (${driver.license.category || '—'})${driver.license.photoUrl ? ` · <a href="${AuthClient.API_BASE}${driver.license.photoUrl}" target="_blank" style="color: var(--accent-cyan);">Ver foto</a>` : ''}</p>` : ''}
          </div>
          <button class="btn btn-outline btn-sm" id="btn-edit-profile" style="align-self: center;"><i class="fa-solid fa-pen"></i></button>
        </div>
      </div>

      <h4 style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-top: 10px;">Telemetría en Tiempo Real</h4>

      <div class="telemetry-grid">
        <div class="gauge-box">
          <i class="fa-solid fa-gauge-high" style="color: var(--accent-cyan);"></i>
          <span class="gauge-val">${fmt(telemetry.speed)}</span>
          <span class="gauge-label">km/h Velocidad</span>
        </div>

        <div class="gauge-box">
          <i class="fa-solid fa-gas-pump" style="color: var(--color-idle);"></i>
          <span class="gauge-val">${fmt(telemetry.fuel)}%</span>
          <span class="gauge-label">Combustible</span>
        </div>

        <div class="gauge-box">
          <i class="fa-solid fa-temperature-three-quarters" style="color: ${telemetry.temp > 95 ? 'var(--color-alert)' : 'var(--color-active)'};"></i>
          <span class="gauge-val">${fmt(telemetry.temp)}°C</span>
          <span class="gauge-label">Temp. Motor</span>
        </div>

        <div class="gauge-box">
          <i class="fa-solid fa-road" style="color: var(--accent-purple);"></i>
          <span class="gauge-val">${telemetry.odometer != null ? Math.round(telemetry.odometer).toLocaleString() : '—'}</span>
          <span class="gauge-label">km Odómetro</span>
        </div>
      </div>

      <div style="display: flex; gap: 10px; margin-top: 10px;">
        <button class="btn btn-primary" style="flex: 1;" onclick="alert('Llamando a ${driver.name || vehicle.id}...')">
          <i class="fa-solid fa-phone"></i> Contactar
        </button>
        <button class="btn btn-outline" style="flex: 1;" onclick="alert('Ruta enviada al vehículo ${vehicle.id}')">
          <i class="fa-solid fa-paper-plane"></i> Despachar
        </button>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px; margin-bottom: 8px;">
        <h4 style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">Ruta y ETA</h4>
        <button class="btn btn-outline btn-sm" id="btn-assign-route"><i class="fa-solid fa-route"></i> Asignar Ruta</button>
      </div>
      <div id="drawer-route-info">
        <p style="color: var(--text-muted); font-size: 0.85rem;">Sin ruta asignada.</p>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px; margin-bottom: 8px;">
        <h4 style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">Documentación Digital</h4>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-outline btn-sm" id="btn-export-documents" title="Exportar PDF"><i class="fa-solid fa-file-export"></i></button>
          <button class="btn btn-outline btn-sm" id="btn-new-document"><i class="fa-solid fa-plus"></i> Nuevo</button>
        </div>
      </div>
      <div id="drawer-documents-list" class="documents-list">
        <p style="color: var(--text-muted); font-size: 0.85rem;">Cargando documentos...</p>
      </div>

      <h4 style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-top: 24px; margin-bottom: 8px;">Bitácora de Eventos</h4>
      <div class="events-timeline">
        <div class="event-item">
          <span class="event-time">15:42</span>
          <span>Actualización de posición GPS recibida</span>
        </div>
        ${vehicle.status === 'alert' ? `
          <div class="event-item alert">
            <span class="event-time">15:40</span>
            <span><strong>ALERTA:</strong> Exceso de velocidad reportado</span>
          </div>
        ` : ''}
        <div class="event-item">
          <span class="event-time">14:15</span>
          <span>Inicio de jornada del conductor</span>
        </div>
      </div>
    `;
  },

  // Render the digital documents list inside the vehicle detail drawer
  renderDocumentsList(container, documents) {
    if (!container) return;

    if (!documents || documents.length === 0) {
      container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Sin documentos emitidos todavía.</p>`;
      return;
    }

    const typeLabels = { FACTURA: 'Factura', BOLETA: 'Boleta', GUIA_REMISION: 'Guía de Remisión' };
    const typeColors = { FACTURA: 'var(--accent-cyan)', BOLETA: 'var(--text-muted)', GUIA_REMISION: 'var(--color-active)' };

    container.innerHTML = documents.map(doc => `
      <div class="document-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: ${typeColors[doc.docType] || 'var(--text-muted)'}; font-size: 0.7rem; font-weight: 700; text-transform: uppercase;">
            ${typeLabels[doc.docType] || doc.docType}
          </span>
          <span style="color: var(--color-active); font-size: 0.7rem; font-weight: 700;">${doc.status}</span>
        </div>
        <p style="color: var(--text-white); font-weight: 600; margin: 4px 0 2px;">${doc.clientName}</p>
        ${doc.deliveryAddress ? `<p style="color: var(--text-muted); font-size: 0.8rem; margin: 0;">${doc.deliveryAddress}</p>` : ''}
        <div style="display: flex; justify-content: space-between; margin-top: 6px;">
          <span style="color: var(--text-muted); font-size: 0.75rem;">${doc.id}</span>
          ${doc.totalAmount ? `<span style="color: var(--text-white); font-size: 0.8rem; font-weight: 600;">S/ ${Number(doc.totalAmount).toFixed(2)}</span>` : ''}
        </div>
      </div>
    `).join('');
  },

  // Display toast alert notification
  showToastAlert(container, alertData) {
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-alert';
    toast.innerHTML = `
      <i class="fa-solid fa-triangle-exclamation"></i>
      <div class="toast-text">
        <strong>${alertData.title}</strong>
        <p>${alertData.message}</p>
      </div>
    `;

    container.prepend(toast);

    // Remove toast after 6 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 6000);
  },

  // Update header counters
  updateFleetCounters(fleet) {
    const counts = {
      active: fleet.filter(v => v.status === 'active').length,
      idle: fleet.filter(v => v.status === 'idle').length,
      alert: fleet.filter(v => v.status === 'alert').length,
      offline: fleet.filter(v => v.status === 'offline').length,
      total: fleet.length
    };

    document.getElementById('count-active').textContent = counts.active;
    document.getElementById('count-idle').textContent = counts.idle;
    document.getElementById('count-alert').textContent = counts.alert;
    document.getElementById('count-offline').textContent = counts.offline;
    document.getElementById('total-count').textContent = counts.total;

    // Calculate averages
    const activeVehicles = fleet.filter(v => v.status !== 'offline');
    const avgSpeed = activeVehicles.reduce((acc, v) => acc + (v.telemetry?.speed || 0), 0) / (activeVehicles.length || 1);
    const avgFuel = activeVehicles.reduce((acc, v) => acc + (v.telemetry?.fuel || 0), 0) / (activeVehicles.length || 1);

    document.getElementById('avg-speed').textContent = `${Math.round(avgSpeed)} km/h`;
    document.getElementById('avg-fuel').textContent = `${Math.round(avgFuel)}%`;
  }
};
