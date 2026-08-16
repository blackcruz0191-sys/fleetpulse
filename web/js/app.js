/**
 * FleetPulse - Main Controller & Application Entry Point
 */

document.addEventListener('DOMContentLoaded', () => {
  // Declared before the auth gate below because a cached session logs the user in
  // synchronously on page load, which calls initDashboard() before this line would
  // otherwise run — referencing a `let` before its declaration throws a TDZ error.
  let dashboardInitialized = false;
  let activeMapManager = null; // set once initDashboard() creates the map; used by the theme toggle below

  // ============================================================
  // Theme Toggle (light/dark) — lives in the always-present header, so it
  // works both on the login screen and inside the dashboard.
  // ============================================================
  const btnToggleTheme = document.getElementById('btn-toggle-theme');
  const themeIcon = btnToggleTheme.querySelector('i');

  function applyTheme(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      themeIcon.className = 'fa-solid fa-sun';
      btnToggleTheme.title = 'Cambiar a modo oscuro';
    } else {
      document.documentElement.removeAttribute('data-theme');
      themeIcon.className = 'fa-solid fa-moon';
      btnToggleTheme.title = 'Cambiar a modo claro';
    }
    activeMapManager?.setBasemapTheme(theme);
  }

  // Sync the icon with whatever the early inline script in index.html already applied.
  applyTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

  btnToggleTheme.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    localStorage.setItem('fleetpulse_theme', next);
    applyTheme(next);
  });

  // ============================================================
  // Browser Push Notifications — native OS notifications for operational
  // alerts (combustible, emergencia, avería, cambio de chofer) when the
  // dashboard tab isn't focused, so an admin doesn't need it open to notice.
  // ============================================================
  function requestNotificationPermission() {
    if (!('Notification' in window)) return; // unsupported browser — silently skip
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function notifyBrowser(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (!document.hidden) return; // the in-app toast already covers this case
    try {
      const n = new Notification(title, { body, tag: 'fleetpulse-alert' });
      n.onclick = () => { window.focus(); n.close(); };
    } catch (e) {
      // Some browsers (older Firefox on Android) throw instead of using the
      // Service Worker notification API — not worth surfacing to the user.
    }
  }

  // ============================================================
  // Auth Gate
  // ============================================================
  const authOverlay = document.getElementById('auth-overlay');
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginError = document.getElementById('login-error');
  const registerError = document.getElementById('register-error');
  const userChipName = document.getElementById('user-chip-name');
  const btnLogout = document.getElementById('btn-logout');
  const driverCodeBanner = document.getElementById('driver-code-banner');
  const driverCodeBannerValue = document.getElementById('driver-code-banner-value');

  // Role selector on the register form
  let selectedRegisterRole = 'admin';
  const roleAdminBtn = document.getElementById('role-admin-btn');
  const roleDriverBtn = document.getElementById('role-driver-btn');
  const registerCompanyGroup = document.getElementById('register-company-group');
  const registerDriverNote = document.getElementById('register-driver-note');
  const registerCompanyInput = document.getElementById('register-company');

  roleAdminBtn.addEventListener('click', () => {
    selectedRegisterRole = 'admin';
    roleAdminBtn.classList.add('active');
    roleDriverBtn.classList.remove('active');
    registerCompanyGroup.style.display = 'flex';
    registerDriverNote.style.display = 'none';
    registerCompanyInput.required = true;
  });

  roleDriverBtn.addEventListener('click', () => {
    selectedRegisterRole = 'driver';
    roleDriverBtn.classList.add('active');
    roleAdminBtn.classList.remove('active');
    registerCompanyGroup.style.display = 'none';
    registerDriverNote.style.display = 'block';
    registerCompanyInput.required = false;
  });

  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    loginForm.style.display = 'flex';
    loginForm.style.flexDirection = 'column';
    registerForm.style.display = 'none';
  });

  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    registerForm.style.display = 'flex';
    registerForm.style.flexDirection = 'column';
    loginForm.style.display = 'none';
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    try {
      const user = await AuthClient.login(
        document.getElementById('login-username').value.trim(),
        document.getElementById('login-password').value
      );
      onAuthenticated(user);
    } catch (err) {
      loginError.textContent = err.message;
    }
  });

  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    registerError.textContent = '';
    try {
      const user = await AuthClient.register(
        document.getElementById('register-username').value.trim(),
        document.getElementById('register-password').value,
        document.getElementById('register-company').value.trim(),
        selectedRegisterRole
      );
      onAuthenticated(user);
    } catch (err) {
      registerError.textContent = err.message;
    }
  });

  btnLogout.addEventListener('click', () => {
    AuthClient.clearSession();
    window.location.reload();
  });

  function onAuthenticated(user) {
    authOverlay.classList.add('hidden');
    userChipName.textContent = user.companyName || user.username;

    if (user.role === 'driver' && user.driverCode) {
      driverCodeBannerValue.textContent = user.driverCode;
      driverCodeBanner.style.display = 'block';
    }

    requestNotificationPermission();
    initDashboard();
  }

  if (AuthClient.isAuthenticated()) {
    const cachedUser = AuthClient.getUser();
    onAuthenticated(cachedUser || { username: 'Usuario' });
  }

  // ============================================================
  // Dashboard (only initialized after a successful login)
  // ============================================================
  function initDashboard() {
    if (dashboardInitialized) return;
    dashboardInitialized = true;

    let fleet = [];
    let geofences = INITIAL_GEOFENCES;
    let selectedVehicleId = null;
    const simulatingVehicles = new Set(); // vehicleId -> tiene una simulación de recorrido en curso
    let currentFilter = 'all';
    let searchQuery = '';

    // DOM Elements
    const vehicleListContainer = document.getElementById('vehicle-list-container');
    const sidebarEl = document.getElementById('fleet-sidebar');
    const sidebarToggleBtn = document.getElementById('btn-toggle-sidebar');
    const sidebarBackdrop = document.getElementById('sidebar-backdrop');
    const drawer = document.getElementById('detail-drawer');
    const drawerContent = document.getElementById('drawer-content');
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    const alertsFeed = document.getElementById('alerts-feed');
    const searchInput = document.getElementById('vehicle-search');
    const btnClearSearch = document.getElementById('btn-clear-search');
    const filterTabs = document.querySelectorAll('.filter-tab');

    // Mobile: the sidebar becomes an off-canvas drawer (see the responsive CSS section)
    // toggled by the hamburger button in the header, with a backdrop to dismiss it.
    function closeSidebarMobile() {
      sidebarEl.classList.remove('open');
      sidebarBackdrop.classList.remove('active');
    }
    sidebarToggleBtn?.addEventListener('click', () => {
      sidebarEl.classList.toggle('open');
      sidebarBackdrop.classList.toggle('active');
    });
    sidebarBackdrop?.addEventListener('click', closeSidebarMobile);

    // Geofence Modal DOM
    const btnAddGeofence = document.getElementById('btn-add-geofence');
    const geofenceModal = document.getElementById('geofence-modal');
    const btnCloseGeofenceModal = document.getElementById('btn-close-geofence-modal');
    const btnCancelGeofence = document.getElementById('btn-cancel-geofence');
    const btnSaveGeofence = document.getElementById('btn-save-geofence');
    const geoShapeSelect = document.getElementById('geo-shape');
    const geoRadiusGroup = document.getElementById('geo-radius-group');
    const geoPolygonGroup = document.getElementById('geo-polygon-group');
    const btnDrawPolygon = document.getElementById('btn-draw-polygon');
    const geoPolygonStatus = document.getElementById('geo-polygon-status');
    const geofenceDrawPanel = document.getElementById('geofence-draw-panel');
    const geofenceDrawCount = document.getElementById('geofence-draw-count');
    const btnCancelPolygon = document.getElementById('btn-cancel-polygon');
    const btnFinishPolygon = document.getElementById('btn-finish-polygon');
    let pendingPolygonPoints = null; // set once "Finalizar" closes the drawing panel

    // Map Controls DOM
    const btnCenterFleet = document.getElementById('btn-center-fleet');
    const btnToggleTrails = document.getElementById('btn-toggle-trails');
    const btnToggleGeofences = document.getElementById('btn-toggle-geofences');

    // 1. Initialize Map Manager
    const mapManager = new FleetMapManager('map', (vehicleId) => {
      selectVehicle(vehicleId);
    });
    activeMapManager = mapManager;

    mapManager.renderGeofences(geofences);

    // 2. Fetch this account's real fleet from the backend
    AuthClient.authedFetch('/api/v1/vehicles')
      .then(r => r.json())
      .then(serverFleet => {
        fleet = serverFleet;
        mapManager.updateFleetMarkers(fleet);
        updateUI();
        if (fleet.length) mapManager.fitFleetBounds(fleet);
      })
      .catch(() => {
        UIComponents.showToastAlert(alertsFeed, {
          title: 'Sin conexión',
          message: 'No se pudo cargar la flota desde el servidor'
        });
      });

    // 3. Real-Time Server Socket.io Listener (authenticated)
    const socket = io(AuthClient.API_BASE, {
      auth: { token: AuthClient.getToken() }
    });

    socket.on('connect_error', (err) => {
      console.log('Error de conexión WebSocket:', err.message);
    });

    socket.on('initial_fleet', (serverFleet) => {
      fleet = serverFleet;
      mapManager.updateFleetMarkers(fleet);
      updateUI();
    });

    socket.on('location_update', (serverVehicle) => {
      upsertVehicle(serverVehicle);
      mapManager.updateFleetMarkers(fleet);
      updateUI();

      if (selectedVehicleId === serverVehicle.id) {
        // renderVehicleDrawer replaces the drawer's innerHTML, which wipes the
        // "Ruta y ETA" / "Documentación Digital" sections — reload them so they
        // don't get stuck showing stale or "Cargando..." placeholders forever.
        UIComponents.renderVehicleDrawer(drawerContent, serverVehicle);
        loadDocumentsForVehicle(serverVehicle.id);
        loadRouteForVehicle(serverVehicle.id);
      }

      UIComponents.showToastAlert(alertsFeed, {
        title: 'GPS en Vivo Recibido',
        message: `${serverVehicle.id} transmitió coordenadas en tiempo real`
      });
    });

    socket.on('profile_update', (serverVehicle) => {
      upsertVehicle(serverVehicle);
      updateUI();

      if (selectedVehicleId === serverVehicle.id) {
        UIComponents.renderVehicleDrawer(drawerContent, serverVehicle);
        loadDocumentsForVehicle(serverVehicle.id);
        loadRouteForVehicle(serverVehicle.id);
      }
    });

    socket.on('document_created', (doc) => {
      UIComponents.showToastAlert(alertsFeed, {
        title: 'Documento Digital Emitido',
        message: `${doc.docType} para ${doc.clientName} (${doc.vehicleId})`
      });

      if (selectedVehicleId === doc.vehicleId) {
        loadDocumentsForVehicle(doc.vehicleId);
      }
    });

    socket.on('route_updated', (route) => {
      if (selectedVehicleId === route.vehicleId) {
        loadRouteForVehicle(route.vehicleId);
      }
    });

    socket.on('simulation_status', (data) => {
      if (data.running) simulatingVehicles.add(data.vehicleId);
      else simulatingVehicles.delete(data.vehicleId);

      if (selectedVehicleId === data.vehicleId) loadRouteForVehicle(data.vehicleId);

      if (data.completed) {
        UIComponents.showToastAlert(alertsFeed, {
          title: 'Simulación Completada',
          message: `${data.vehicleId} llegó al final de su ruta simulada`
        });
      }
    });

    const ALERT_LABELS = {
      FUEL_STOP: { title: 'Parada de Combustible', icon: 'fa-gas-pump' },
      EMERGENCY: { title: 'EMERGENCIA', icon: 'fa-triangle-exclamation' },
      BREAKDOWN: { title: 'Vehículo Averiado', icon: 'fa-car-burst' },
      DRIVER_CHANGE: { title: 'Cambio de Chofer', icon: 'fa-user-gear' }
    };

    socket.on('alert_created', (alert) => {
      const info = ALERT_LABELS[alert.type] || { title: alert.type, icon: 'fa-bell' };
      const title = `${info.title} — ${alert.vehicleId}`;
      const message = alert.message || 'Alerta reportada desde la app del chofer';
      UIComponents.showToastAlert(alertsFeed, { title, message });
      notifyBrowser(title, message);

      openAlertCount += 1;
      updateAlertsBadge();
      if (alertsLogModal.classList.contains('active')) loadAlertsLog();
    });

    socket.on('alert_resolved', () => {
      if (alertsLogModal.classList.contains('active')) loadAlertsLog();
    });

    // ------------------------------------------------------------
    // Alerts Log Panel (persistent history — the toasts above vanish after 6s)
    // ------------------------------------------------------------
    const alertsLogModal = document.getElementById('alerts-log-modal');
    const alertsLogList = document.getElementById('alerts-log-list');
    const alertsBadge = document.getElementById('alerts-badge');
    let openAlertCount = 0;

    function updateAlertsBadge() {
      if (openAlertCount > 0) {
        alertsBadge.textContent = openAlertCount > 9 ? '9+' : String(openAlertCount);
        alertsBadge.style.display = 'flex';
      } else {
        alertsBadge.style.display = 'none';
      }
    }

    function formatAlertTime(ts) {
      return new Date(ts).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    function loadAlertsLog() {
      AuthClient.authedFetch('/api/v1/alerts')
        .then(r => r.json())
        .then(alerts => {
          openAlertCount = alerts.filter(a => a.status === 'OPEN').length;
          updateAlertsBadge();

          if (alerts.length === 0) {
            alertsLogList.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No hay alertas registradas todavía.</p>`;
            return;
          }

          alertsLogList.innerHTML = alerts.map(a => {
            const info = ALERT_LABELS[a.type] || { title: a.type, icon: 'fa-bell' };
            const resolved = a.status === 'RESOLVED';
            return `
              <div class="alert-log-row ${resolved ? 'resolved' : ''}">
                <div class="alert-log-icon"><i class="fa-solid ${info.icon}"></i></div>
                <div class="alert-log-body">
                  <div class="alert-log-title">${info.title} — ${a.vehicleId}</div>
                  <div class="alert-log-meta">${a.message || 'Sin comentario'} · ${formatAlertTime(a.createdAt)}</div>
                </div>
                ${resolved
                  ? `<span style="font-size:0.7rem; color: var(--color-active); font-weight:700;">RESUELTA</span>`
                  : `<button class="btn btn-outline btn-sm" data-resolve-id="${a.id}">Resolver</button>`}
              </div>
            `;
          }).join('');

          alertsLogList.querySelectorAll('[data-resolve-id]').forEach(btn => {
            btn.addEventListener('click', () => {
              AuthClient.authedFetch(`/api/v1/alerts/${btn.dataset.resolveId}/resolve`, { method: 'POST' })
                .then(() => loadAlertsLog())
                .catch(() => alert('No se pudo resolver la alerta'));
            });
          });
        })
        .catch(() => {
          alertsLogList.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No se pudo cargar el historial de alertas.</p>`;
        });
    }

    document.getElementById('btn-open-alerts-log').addEventListener('click', () => {
      alertsLogModal.classList.add('active');
      loadAlertsLog();
    });
    document.getElementById('btn-close-alerts-log').addEventListener('click', () => alertsLogModal.classList.remove('active'));
    document.getElementById('btn-close-alerts-log-2').addEventListener('click', () => alertsLogModal.classList.remove('active'));

    // Populate the badge on load without waiting for the user to open the panel
    loadAlertsLog();

    function upsertVehicle(serverVehicle) {
      const index = fleet.findIndex(v => v.id === serverVehicle.id);
      if (index !== -1) {
        fleet[index] = { ...fleet[index], ...serverVehicle };
      } else {
        fleet.push(serverVehicle);
      }
    }

    // Fetch and render digital documents for the selected vehicle
    function loadDocumentsForVehicle(vehicleId) {
      AuthClient.authedFetch(`/api/v1/documents/${vehicleId}`)
        .then(r => r.json())
        .then(docs => {
          const container = document.getElementById('drawer-documents-list');
          UIComponents.renderDocumentsList(container, docs);
        })
        .catch(() => {
          const container = document.getElementById('drawer-documents-list');
          if (container) container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No se pudo conectar al servidor.</p>`;
        });
    }

    // Fetch the vehicle's active route, resolve it against OSRM (real road route + ETA),
    // and render both the map polyline and the drawer's "Ruta y ETA" panel.
    function loadRouteForVehicle(vehicleId) {
      const infoContainer = document.getElementById('drawer-route-info');

      AuthClient.authedFetch(`/api/v1/routes/${vehicleId}`)
        .then(r => r.json())
        .then(route => {
          if (!route || !route.stops || route.stops.length === 0) {
            if (infoContainer) infoContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Sin ruta asignada.</p>`;
            mapManager.clearRouteLine();
            mapManager.clearStopMarkers();
            return;
          }

          const vehicle = fleet.find(v => v.id === vehicleId);
          const waypoints = [];
          if (vehicle?.telemetry?.lat != null && vehicle?.telemetry?.lng != null) {
            waypoints.push([vehicle.telemetry.lng, vehicle.telemetry.lat]);
          }
          route.stops.forEach(s => waypoints.push([s.lng, s.lat]));

          mapManager.renderStopMarkers(route.stops);

          if (waypoints.length < 2) {
            if (infoContainer) infoContainer.innerHTML = renderRouteStopsOnly(route.stops) + simulateButtonHtml(vehicleId);
            return;
          }

          const coordsStr = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(';');
          fetch(`https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`)
            .then(r => r.json())
            .then(data => {
              const leg = data.routes?.[0];
              if (!leg) throw new Error('no route');

              const latlngs = leg.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
              mapManager.drawRouteLine(latlngs);

              const etaMin = Math.round(leg.duration / 60);
              const distKm = (leg.distance / 1000).toFixed(1);

              if (infoContainer) {
                infoContainer.innerHTML = `
                  <div class="route-eta-box">
                    <div class="eta-item"><span class="eta-value">${etaMin} min</span><span class="eta-label">ETA Total</span></div>
                    <div class="eta-item"><span class="eta-value">${distKm} km</span><span class="eta-label">Distancia</span></div>
                    <div class="eta-item"><span class="eta-value">${route.stops.length}</span><span class="eta-label">Paradas</span></div>
                  </div>
                  ${renderRouteStopsOnly(route.stops)}
                  ${simulateButtonHtml(vehicleId)}
                `;
              }
            })
            .catch(() => {
              if (infoContainer) infoContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No se pudo calcular la ruta (sin conexión a OSRM).</p>${renderRouteStopsOnly(route.stops)}${simulateButtonHtml(vehicleId)}`;
            });
        })
        .catch(() => {
          if (infoContainer) infoContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No se pudo cargar la ruta.</p>`;
        });
    }

    // Botón "Simular Recorrido" / "Detener Simulación" — su estado (corriendo o no) se
    // guarda localmente en simulatingVehicles y se mantiene al día vía el evento de
    // socket 'simulation_status', para no tener que consultar el servidor en cada render.
    function simulateButtonHtml(vehicleId) {
      const running = simulatingVehicles.has(vehicleId);
      return `<button id="btn-simulate-route" class="btn ${running ? 'btn-outline' : 'btn-primary'} btn-sm"
        style="width:100%; margin-top:10px;" data-vehicle-id="${vehicleId}">
        <i class="fa-solid ${running ? 'fa-stop' : 'fa-play'}"></i> ${running ? 'Detener Simulación' : 'Simular Recorrido'}
      </button>`;
    }

    function renderRouteStopsOnly(stops) {
      return `<div style="margin-top: 8px;">${stops.map((s, i) => `
        <div style="display:flex; gap:8px; align-items:center; font-size:0.78rem; padding:4px 0; color: var(--text-muted);">
          <span class="stop-index" style="width:18px;height:18px;border-radius:50%;background:#f59e0b;color:white;font-size:0.65rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i + 1}</span>
          ${s.label || `Parada ${i + 1}`}
        </div>`).join('')}</div>`;
    }

    // Route assignment: click-to-add-stops mode
    const routePanel = document.getElementById('route-panel');
    const routeStopsListEl = document.getElementById('route-stops-list');
    const btnCancelRoute = document.getElementById('btn-cancel-route');
    const btnSaveRoute = document.getElementById('btn-save-route');
    let pendingStops = [];
    let isPickingRoute = false;

    function renderPendingStops() {
      routeStopsListEl.innerHTML = pendingStops.map((s, i) => `
        <div class="route-stop-row">
          <span class="stop-index">${i + 1}</span>
          <input type="text" data-idx="${i}" class="stop-label-input" value="${s.label}" />
          <button class="remove-stop" data-idx="${i}">✕</button>
        </div>
      `).join('') || `<p style="color: var(--text-dim); font-size: 0.75rem;">Aún no hay paradas.</p>`;

      routeStopsListEl.querySelectorAll('.stop-label-input').forEach(input => {
        input.addEventListener('input', (e) => {
          pendingStops[Number(e.target.dataset.idx)].label = e.target.value;
        });
      });
      routeStopsListEl.querySelectorAll('.remove-stop').forEach(btn => {
        btn.addEventListener('click', () => {
          pendingStops.splice(Number(btn.dataset.idx), 1);
          renderPendingStops();
          mapManager.renderStopMarkers(pendingStops);
        });
      });
    }

    function startRouteAssignment() {
      if (!selectedVehicleId) {
        alert('Selecciona un vehículo primero');
        return;
      }
      pendingStops = [];
      isPickingRoute = true;
      renderPendingStops();
      mapManager.clearStopMarkers();
      routePanel.style.display = 'block';
      mapManager.startStopPicking((lat, lng) => {
        pendingStops.push({ label: `Parada ${pendingStops.length + 1}`, lat, lng });
        renderPendingStops();
        mapManager.renderStopMarkers(pendingStops);
      });
    }

    function endRouteAssignment() {
      isPickingRoute = false;
      mapManager.stopStopPicking();
      routePanel.style.display = 'none';
    }

    btnCancelRoute.addEventListener('click', () => {
      endRouteAssignment();
      if (selectedVehicleId) loadRouteForVehicle(selectedVehicleId);
      else { mapManager.clearStopMarkers(); mapManager.clearRouteLine(); }
    });

    btnSaveRoute.addEventListener('click', () => {
      if (pendingStops.length === 0) {
        alert('Agrega al menos una parada haciendo clic en el mapa');
        return;
      }
      AuthClient.authedFetch('/api/v1/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicle_id: selectedVehicleId, stops: pendingStops })
      })
        .then(r => r.json())
        .then(() => {
          endRouteAssignment();
          loadRouteForVehicle(selectedVehicleId);
          UIComponents.showToastAlert(alertsFeed, {
            title: 'Ruta Asignada',
            message: `${pendingStops.length} parada(s) asignadas a ${selectedVehicleId}`
          });
        })
        .catch(() => alert('No se pudo guardar la ruta'));
    });

    // Document creation modal
    const documentModal = document.getElementById('document-modal');
    document.getElementById('btn-close-document-modal').addEventListener('click', () => documentModal.classList.remove('active'));
    document.getElementById('btn-cancel-document').addEventListener('click', () => documentModal.classList.remove('active'));

    document.getElementById('btn-save-document').addEventListener('click', () => {
      const clientName = document.getElementById('doc-client-name').value.trim();
      const address = document.getElementById('doc-address').value.trim();
      if (!clientName || !address) {
        alert('Cliente y dirección de entrega son obligatorios');
        return;
      }

      const payload = {
        vehicle_id: selectedVehicleId,
        doc_type: document.getElementById('doc-type').value,
        doc_number: document.getElementById('doc-number').value.trim(),
        client_name: clientName,
        client_ruc: document.getElementById('doc-client-ruc').value.trim(),
        delivery_address: address,
        items_summary: document.getElementById('doc-items').value.trim(),
        total_amount: parseFloat(document.getElementById('doc-amount').value) || 0
      };

      AuthClient.authedFetch('/api/v1/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(r => r.json())
        .then(() => {
          documentModal.classList.remove('active');
          document.getElementById('document-form').reset();
          loadDocumentsForVehicle(selectedVehicleId);
        })
        .catch(() => alert('No se pudo emitir el documento'));
    });

    // Driver & Vehicle profile modal (incl. brevete)
    const profileModal = document.getElementById('profile-modal');
    document.getElementById('btn-close-profile-modal').addEventListener('click', () => profileModal.classList.remove('active'));
    document.getElementById('btn-cancel-profile').addEventListener('click', () => profileModal.classList.remove('active'));

    let isCreatingNewVehicle = false;
    const profVehicleIdInput = document.getElementById('prof-vehicle-id');
    const profVehicleIdGroup = document.getElementById('prof-vehicle-id-group');
    const profileModalTitle = document.getElementById('profile-modal-title');

    function openProfileModal() {
      isCreatingNewVehicle = false;
      const vehicle = fleet.find(v => v.id === selectedVehicleId);
      if (!vehicle) return;

      profileModalTitle.innerHTML = '<i class="fa-solid fa-id-card"></i> Perfil de Chofer y Vehículo';
      profVehicleIdGroup.style.display = 'none';
      profVehicleIdInput.value = vehicle.id;

      document.getElementById('prof-driver-name').value = vehicle.driver?.name || '';
      document.getElementById('prof-driver-phone').value = vehicle.driver?.phone || '';
      document.getElementById('prof-vehicle-model').value = vehicle.name || '';
      document.getElementById('prof-plate').value = vehicle.plate || '';
      document.getElementById('prof-cargo-type').value = vehicle.cargo?.type || '';
      document.getElementById('prof-cargo-weight').value = vehicle.cargo?.weightKg || '';
      document.getElementById('prof-license-number').value = vehicle.driver?.license?.number || '';
      document.getElementById('prof-license-category').value = vehicle.driver?.license?.category || '';
      document.getElementById('prof-license-issue').value = vehicle.driver?.license?.issueDate || '';
      document.getElementById('prof-license-expiry').value = vehicle.driver?.license?.expiryDate || '';
      document.getElementById('prof-license-restrictions').value = vehicle.driver?.license?.restrictions || '';
      document.getElementById('prof-license-infractions').value = vehicle.driver?.license?.infractions || '';

      profileModal.classList.add('active');
    }

    function openNewVehicleModal() {
      isCreatingNewVehicle = true;
      document.getElementById('profile-form').reset();
      profileModalTitle.innerHTML = '<i class="fa-solid fa-truck-fast"></i> Nuevo Vehículo';
      profVehicleIdGroup.style.display = 'flex';
      profVehicleIdInput.value = '';
      profileModal.classList.add('active');
    }

    document.getElementById('btn-add-vehicle').addEventListener('click', openNewVehicleModal);

    // Add Driver to Fleet modal (claims an independently-registered driver via their code)
    const addDriverModal = document.getElementById('add-driver-modal');
    const addDriverCodeInput = document.getElementById('add-driver-code');
    const addDriverError = document.getElementById('add-driver-error');

    document.getElementById('btn-add-driver').addEventListener('click', () => {
      addDriverCodeInput.value = '';
      addDriverError.textContent = '';
      addDriverModal.classList.add('active');
    });
    document.getElementById('btn-close-add-driver').addEventListener('click', () => addDriverModal.classList.remove('active'));
    document.getElementById('btn-cancel-add-driver').addEventListener('click', () => addDriverModal.classList.remove('active'));

    document.getElementById('btn-confirm-add-driver').addEventListener('click', () => {
      const code = addDriverCodeInput.value.trim().toUpperCase();
      if (!code) {
        addDriverError.textContent = 'Ingresa el código del chofer';
        return;
      }

      AuthClient.authedFetch('/api/v1/fleet/claim-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_code: code })
      })
        .then(r => r.json())
        .then(res => {
          if (!res.success) {
            addDriverError.textContent = res.message || 'No se pudo agregar al chofer';
            return;
          }
          addDriverModal.classList.remove('active');
          (res.vehicles || []).forEach(v => { upsertVehicle(v); });
          updateUI();
          UIComponents.showToastAlert(alertsFeed, {
            title: 'Chofer Agregado',
            message: `Se agregó a tu flota con ${res.vehicles.length} vehículo(s)`
          });
        })
        .catch(() => { addDriverError.textContent = 'No se pudo conectar al servidor'; });
    });

    document.getElementById('btn-save-profile').addEventListener('click', () => {
      const driverName = document.getElementById('prof-driver-name').value.trim();
      const plate = document.getElementById('prof-plate').value.trim();
      const vehicleModel = document.getElementById('prof-vehicle-model').value.trim();
      const vehicleId = isCreatingNewVehicle ? profVehicleIdInput.value.trim().toUpperCase() : selectedVehicleId;

      if (!driverName || !plate || !vehicleModel) {
        alert('Nombre del chofer, modelo y placa son obligatorios');
        return;
      }
      if (!vehicleId) {
        alert('El ID de vehículo es obligatorio (ej. CAM-101)');
        return;
      }
      if (isCreatingNewVehicle && fleet.some(v => v.id === vehicleId)) {
        alert(`Ya existe un vehículo con el ID "${vehicleId}". Usa uno distinto.`);
        return;
      }

      const payload = {
        vehicle_id: vehicleId,
        driver_name: driverName,
        driver_phone: document.getElementById('prof-driver-phone').value.trim(),
        vehicle_model: vehicleModel,
        plate: plate,
        cargo_type: document.getElementById('prof-cargo-type').value.trim(),
        cargo_weight_kg: parseFloat(document.getElementById('prof-cargo-weight').value) || 0,
        license_number: document.getElementById('prof-license-number').value.trim(),
        license_category: document.getElementById('prof-license-category').value,
        license_issue_date: document.getElementById('prof-license-issue').value,
        license_expiry_date: document.getElementById('prof-license-expiry').value,
        license_restrictions: document.getElementById('prof-license-restrictions').value.trim(),
        license_infractions: document.getElementById('prof-license-infractions').value.trim()
      };

      AuthClient.authedFetch('/api/v1/driver/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(r => r.json())
        .then((res) => {
          if (!res.success) {
            alert(res.message || 'No se pudo guardar el perfil');
            return;
          }
          profileModal.classList.remove('active');
          if (isCreatingNewVehicle) {
            UIComponents.showToastAlert(alertsFeed, {
              title: 'Vehículo Registrado',
              message: `${vehicleId} fue agregado a tu flota`
            });
          }
        })
        .catch(() => alert('No se pudo guardar el perfil'));
    });

    // Event delegation for buttons rendered inside the drawer (its innerHTML is replaced on every render)
    drawerContent.addEventListener('click', (e) => {
      if (e.target.closest('#btn-assign-route')) startRouteAssignment();
      if (e.target.closest('#btn-new-document')) {
        if (!selectedVehicleId) { alert('Selecciona un vehículo primero'); return; }
        document.getElementById('document-form').reset();
        documentModal.classList.add('active');
      }
      if (e.target.closest('#btn-edit-profile')) openProfileModal();

      const simBtn = e.target.closest('#btn-simulate-route');
      if (simBtn) {
        const vehicleId = simBtn.dataset.vehicleId;
        const action = simulatingVehicles.has(vehicleId) ? 'stop' : 'start';
        simBtn.disabled = true;
        AuthClient.authedFetch(`/api/v1/routes/${vehicleId}/simulate/${action}`, { method: 'POST' })
          .then(r => r.json())
          .then(data => {
            if (!data.success) { alert(data.message || 'No se pudo cambiar la simulación'); return; }
            if (action === 'start') simulatingVehicles.add(vehicleId);
            else simulatingVehicles.delete(vehicleId);
            if (selectedVehicleId === vehicleId) loadRouteForVehicle(vehicleId);
          })
          .catch(() => alert('No se pudo conectar al servidor'))
          .finally(() => { simBtn.disabled = false; });
      }
    });

    // 4. Selection & Filtering logic
    function selectVehicle(id) {
      selectedVehicleId = id;
      const vehicle = fleet.find(v => v.id === id);
      if (!vehicle) return;

      closeSidebarMobile(); // no-op on desktop; on mobile, picking a vehicle closes the drawer

      if (isPickingRoute) endRouteAssignment();

      UIComponents.renderVehicleDrawer(drawerContent, vehicle);
      drawer.classList.add('open');
      loadDocumentsForVehicle(id);

      // Sincroniza si ya hay una simulación corriendo para este vehículo (por ejemplo,
      // si se inició desde otra sesión del dashboard) antes de dibujar el botón.
      AuthClient.authedFetch(`/api/v1/routes/${id}/simulate/status`)
        .then(r => r.json())
        .then(data => { if (data.running) simulatingVehicles.add(id); else simulatingVehicles.delete(id); })
        .catch(() => {})
        .finally(() => loadRouteForVehicle(id));

      mapManager.centerOnVehicle(vehicle);
      updateUI();
    }

    function getFilteredFleet() {
      return fleet.filter(v => {
        const matchesFilter = currentFilter === 'all' || v.status === currentFilter;

        const q = searchQuery.toLowerCase();
        const matchesSearch = !q ||
          v.id.toLowerCase().includes(q) ||
          (v.plate || '').toLowerCase().includes(q) ||
          (v.driver?.name || '').toLowerCase().includes(q) ||
          (v.name || '').toLowerCase().includes(q);

        return matchesFilter && matchesSearch;
      });
    }

    function updateUI() {
      const filteredFleet = getFilteredFleet();
      UIComponents.renderVehicleList(vehicleListContainer, filteredFleet, selectedVehicleId, selectVehicle);
      UIComponents.updateFleetCounters(fleet);
    }

    // 5. Event Listeners & Controls

    btnCloseDrawer.addEventListener('click', () => {
      drawer.classList.remove('open');
      selectedVehicleId = null;
      updateUI();
    });

    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      btnClearSearch.style.display = searchQuery ? 'block' : 'none';
      updateUI();
    });

    btnClearSearch.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      btnClearSearch.style.display = 'none';
      updateUI();
    });

    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.getAttribute('data-filter');
        updateUI();
      });
    });

    btnCenterFleet.addEventListener('click', () => {
      mapManager.fitFleetBounds(fleet);
    });

    btnToggleTrails.addEventListener('click', () => {
      btnToggleTrails.classList.toggle('active');
      mapManager.toggleTrails(btnToggleTrails.classList.contains('active'));
    });

    btnToggleGeofences.addEventListener('click', () => {
      btnToggleGeofences.classList.toggle('active');
      mapManager.toggleGeofences(btnToggleGeofences.classList.contains('active'));
    });

    function updateGeoShapeFields() {
      const isPolygon = geoShapeSelect.value === 'polygon';
      geoRadiusGroup.style.display = isPolygon ? 'none' : 'block';
      geoPolygonGroup.style.display = isPolygon ? 'block' : 'none';
    }
    geoShapeSelect.addEventListener('change', updateGeoShapeFields);

    btnAddGeofence.addEventListener('click', () => {
      pendingPolygonPoints = null;
      geoShapeSelect.value = 'circle';
      updateGeoShapeFields();
      geoPolygonStatus.textContent = 'Toca el botón y luego haz clic en el mapa para marcar cada esquina de la zona.';
      geofenceModal.classList.add('active');
    });
    btnCloseGeofenceModal.addEventListener('click', () => geofenceModal.classList.remove('active'));
    btnCancelGeofence.addEventListener('click', () => geofenceModal.classList.remove('active'));

    // Drawing a polygon hides the modal so the map is fully clickable, then
    // reopens it once "Finalizar" closes the shape — same pattern as route stops.
    btnDrawPolygon.addEventListener('click', () => {
      geofenceModal.classList.remove('active');
      geofenceDrawPanel.style.display = 'block';
      geofenceDrawCount.textContent = '0 puntos agregados';
      mapManager.startGeofenceDrawing((count) => {
        geofenceDrawCount.textContent = `${count} punto${count === 1 ? '' : 's'} agregado${count === 1 ? '' : 's'}`;
      });
    });

    function endGeofenceDrawing() {
      mapManager.stopGeofenceDrawing();
      geofenceDrawPanel.style.display = 'none';
    }

    btnCancelPolygon.addEventListener('click', () => {
      endGeofenceDrawing();
      mapManager.clearGeofenceDrawing();
      geofenceModal.classList.add('active');
    });

    btnFinishPolygon.addEventListener('click', () => {
      if (mapManager.geofenceDrawPoints.length < 3) {
        alert('Marca al menos 3 puntos para formar un polígono');
        return;
      }
      pendingPolygonPoints = [...mapManager.geofenceDrawPoints];
      endGeofenceDrawing();
      mapManager.clearGeofenceDrawing();
      geoPolygonStatus.textContent = `Polígono listo (${pendingPolygonPoints.length} puntos). Completa el nombre y guarda.`;
      geofenceModal.classList.add('active');
    });

    btnSaveGeofence.addEventListener('click', (e) => {
      e.preventDefault();
      const name = document.getElementById('geo-name').value;
      const type = document.getElementById('geo-type').value;
      const shape = geoShapeSelect.value;
      const radius = parseInt(document.getElementById('geo-radius').value, 10);

      if (!name) {
        alert('Por favor introduce un nombre para la geocerca');
        return;
      }
      if (shape === 'polygon' && !pendingPolygonPoints) {
        alert('Primero dibuja el polígono en el mapa con el botón de arriba');
        return;
      }

      const color = type === 'depot' ? '#3b82f6' : (type === 'client' ? '#10b981' : '#ef4444');
      const center = mapManager.map.getCenter();
      const newGeo = shape === 'polygon'
        ? { id: `geo-${Date.now()}`, name, type, shape: 'polygon', points: pendingPolygonPoints, color }
        : { id: `geo-${Date.now()}`, name, type, shape: 'circle', lat: center.lat, lng: center.lng, radius: radius || 300, color };

      geofences.push(newGeo);
      mapManager.renderGeofences(geofences);
      geofenceModal.classList.remove('active');
      pendingPolygonPoints = null;

      UIComponents.showToastAlert(alertsFeed, {
        title: 'Geocerca Creada',
        message: `La zona "${name}" fue registrada exitosamente.`
      });
    });

    // Initial draw
    mapManager.updateFleetMarkers(fleet);
    updateUI();
  }
});
