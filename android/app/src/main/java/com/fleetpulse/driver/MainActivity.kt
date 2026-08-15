package com.fleetpulse.driver

import android.Manifest
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.fleetpulse.driver.data.ProfileStore
import com.fleetpulse.driver.data.SessionManager
import com.fleetpulse.driver.model.AlertPayload
import com.fleetpulse.driver.model.AlertType
import com.fleetpulse.driver.model.AssignedRoute
import com.fleetpulse.driver.model.DigitalDocument
import com.fleetpulse.driver.model.DriverProfile
import com.fleetpulse.driver.model.LoginRequest
import com.fleetpulse.driver.model.RegisterRequest
import com.fleetpulse.driver.network.FleetApiService
import com.fleetpulse.driver.service.LocationTrackingService
import com.fleetpulse.driver.ui.AdminHomeScreen
import com.fleetpulse.driver.ui.AuthScreen
import com.fleetpulse.driver.ui.DocumentsScreen
import com.fleetpulse.driver.ui.DriverDashboardScreen
import com.fleetpulse.driver.ui.DriverProfileScreen
import com.fleetpulse.driver.ui.RouteScreen
import com.fleetpulse.driver.ui.theme.FleetPulseTheme
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody

class MainActivity : ComponentActivity() {

    private var isTrackingActive by mutableStateOf(false)
    private var currentLat by mutableStateOf(-12.046374) // Plaza Mayor de Lima (placeholder until first GPS fix)
    private var currentLng by mutableStateOf(-77.042793)
    private var currentSpeed by mutableStateOf(0f)

    private var isAuthenticated by mutableStateOf(false)
    private var isAuthLoading by mutableStateOf(false)
    private var authError by mutableStateOf<String?>(null)
    private var driverCodeToShow by mutableStateOf<String?>(null)

    private lateinit var profileStore: ProfileStore
    private var driverProfile by mutableStateOf<DriverProfile?>(null)
    private var showProfileScreen by mutableStateOf(false)

    private var showDocumentsScreen by mutableStateOf(false)
    private var documents by mutableStateOf<List<DigitalDocument>>(emptyList())
    private var isLoadingDocuments by mutableStateOf(false)

    private var assignedRoute by mutableStateOf<AssignedRoute?>(null)
    private var showRouteScreen by mutableStateOf(false)
    private var isSimulatingRoute by mutableStateOf(false)
    private var isSimulationLoading by mutableStateOf(false)

    private val locationBroadcastReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            intent?.let {
                currentLat = it.getDoubleExtra(LocationTrackingService.EXTRA_LAT, currentLat)
                currentLng = it.getDoubleExtra(LocationTrackingService.EXTRA_LNG, currentLng)
                currentSpeed = it.getFloatExtra(LocationTrackingService.EXTRA_SPEED, 0f)
            }
        }
    }

    private val requestPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineLocationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        if (fineLocationGranted) {
            startTrackingService()
        } else {
            Toast.makeText(this, "Se requieren permisos de GPS para transmitir la ubicación", Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        SessionManager.init(this)
        isAuthenticated = SessionManager.isAuthenticated()

        profileStore = ProfileStore(this)
        driverProfile = profileStore.load()
        showProfileScreen = driverProfile == null

        setContent {
            FleetPulseTheme {
                if (!isAuthenticated) {
                    AuthScreen(
                        isLoading = isAuthLoading,
                        errorMessage = authError,
                        onLogin = { username, password, expectedRole -> login(username, password, expectedRole) },
                        onRegister = { username, password, companyName, role -> register(username, password, companyName, role) }
                    )
                } else if (SessionManager.role == "admin") {
                    AdminHomeScreen(
                        username = SessionManager.username,
                        companyName = SessionManager.companyName,
                        onOpenDashboard = {
                            startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(FleetApiService.BASE_URL)))
                        },
                        onLogout = { logout() }
                    )
                } else if (driverProfile == null || showProfileScreen) {
                    DriverProfileScreen(
                        initialProfile = driverProfile,
                        isFirstLaunch = driverProfile == null,
                        onSave = { profile -> saveDriverProfile(profile) },
                        onCancel = {
                            // Sin perfil todavía no hay dashboard al que volver — la flecha
                            // de "volver" en el primer registro cierra sesión en su lugar,
                            // para no dejar al usuario atrapado sin salida en esta pantalla.
                            if (driverProfile == null) logout() else showProfileScreen = false
                        }
                    )
                } else if (showDocumentsScreen) {
                    val profile = driverProfile!!
                    DocumentsScreen(
                        vehicleId = profile.vehicleId,
                        documents = documents,
                        isLoading = isLoadingDocuments,
                        onBack = { showDocumentsScreen = false },
                        onCreateDocument = { doc -> createDocument(doc) },
                        onRefresh = { loadDocuments() }
                    )
                } else if (showRouteScreen) {
                    RouteScreen(
                        route = assignedRoute,
                        currentLatitude = currentLat,
                        currentLongitude = currentLng,
                        isSimulating = isSimulatingRoute,
                        isSimulationLoading = isSimulationLoading,
                        onToggleSimulation = { toggleRouteSimulation() },
                        onBack = { showRouteScreen = false },
                        onRefresh = { loadAssignedRoute() }
                    )

                    LaunchedEffect(assignedRoute?.vehicleId) {
                        loadSimulationStatus()
                    }
                } else {
                    val profile = driverProfile!!
                    DriverDashboardScreen(
                        driverName = profile.driverName,
                        vehicleLabel = "${profile.vehicleModel} (${profile.vehicleId})",
                        isTrackingActive = isTrackingActive,
                        currentLatitude = currentLat,
                        currentLongitude = currentLng,
                        currentSpeedKmh = currentSpeed,
                        assignedRoute = assignedRoute,
                        driverCode = SessionManager.driverCode,
                        onToggleDuty = { enabled ->
                            if (enabled) {
                                checkAndRequestPermissions()
                            } else {
                                stopTrackingService()
                            }
                        },
                        onSendAlert = { type, message -> sendAlert(type, message) },
                        onOpenProfile = { showProfileScreen = true },
                        onOpenDocuments = {
                            showDocumentsScreen = true
                            loadDocuments()
                        },
                        onOpenRoute = { showRouteScreen = true },
                        onLogout = { logout() }
                    )

                    LaunchedEffect(profile.vehicleId) {
                        loadAssignedRoute()
                    }
                }

                driverCodeToShow?.let { code ->
                    AlertDialog(
                        onDismissRequest = { driverCodeToShow = null },
                        title = { Text("¡Cuenta de Chofer Creada!") },
                        text = {
                            Column {
                                Text("Tu código único es:")
                                Text(text = code, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                                Spacer(modifier = Modifier.height(8.dp))
                                Text("Compártelo con tu administrador de flota para que te agregue a su flota. También podrás verlo luego en tu perfil.")
                            }
                        },
                        confirmButton = {
                            TextButton(onClick = { driverCodeToShow = null }) { Text("Entendido") }
                        }
                    )
                }
            }
        }
    }

    private fun login(username: String, password: String, expectedRole: String) {
        authError = null
        isAuthLoading = true
        lifecycleScope.launch {
            try {
                val apiService = FleetApiService.create()
                val response = apiService.login(LoginRequest(username, password))
                val body = response.body()
                if (response.isSuccessful && body?.token != null && body.user != null) {
                    val actualRole = body.user.role ?: "admin"
                    if (actualRole != expectedRole) {
                        authError = if (actualRole == "admin")
                            "Esta cuenta es de Administrador de Flota. Cambia a esa pestaña para ingresar."
                        else
                            "Esta cuenta es de Chofer. Cambia a esa pestaña para ingresar."
                        return@launch
                    }
                    SessionManager.save(this@MainActivity, body.token, body.user.username, body.user.companyName, body.user.role, body.user.driverCode)
                    isAuthenticated = true
                } else {
                    authError = body?.message ?: "Usuario o contraseña incorrectos"
                }
            } catch (e: Exception) {
                authError = "No se pudo conectar al servidor"
            } finally {
                isAuthLoading = false
            }
        }
    }

    private fun register(username: String, password: String, companyName: String, role: String) {
        authError = null
        isAuthLoading = true
        lifecycleScope.launch {
            try {
                val apiService = FleetApiService.create()
                val response = apiService.register(RegisterRequest(username, password, companyName, role))
                val body = response.body()
                if (response.isSuccessful && body?.token != null && body.user != null) {
                    SessionManager.save(this@MainActivity, body.token, body.user.username, body.user.companyName, body.user.role, body.user.driverCode)
                    isAuthenticated = true
                    if (body.user.role == "driver" && !body.user.driverCode.isNullOrBlank()) {
                        driverCodeToShow = body.user.driverCode
                    }
                } else {
                    authError = body?.message ?: "No se pudo crear la cuenta"
                }
            } catch (e: Exception) {
                authError = "No se pudo conectar al servidor"
            } finally {
                isAuthLoading = false
            }
        }
    }

    private fun logout() {
        if (isTrackingActive) stopTrackingService()
        SessionManager.clear(this)
        // The local driver profile belongs to the account that's logging out; clear it so
        // the next account that signs in on this device goes through its own setup.
        profileStore.clear()
        driverProfile = null
        showProfileScreen = false
        showDocumentsScreen = false
        showRouteScreen = false
        assignedRoute = null
        isSimulatingRoute = false
        isAuthenticated = false
    }

    private fun saveDriverProfile(profile: DriverProfile) {
        profileStore.save(profile)
        driverProfile = profile
        showProfileScreen = false

        lifecycleScope.launch {
            try {
                val apiService = FleetApiService.create()

                // A "content://" URL means the driver just picked a new photo locally and it
                // hasn't been uploaded yet — send it to the server first and swap in the
                // returned path before saving the profile, so the dashboard can display it too.
                var profileToSend = profile
                if (profile.licensePhotoUrl.startsWith("content://")) {
                    val uploadedUrl = uploadLicensePhoto(android.net.Uri.parse(profile.licensePhotoUrl), apiService)
                    if (uploadedUrl != null) {
                        profileToSend = profile.copy(licensePhotoUrl = uploadedUrl)
                        profileStore.save(profileToSend)
                        driverProfile = profileToSend
                    } else {
                        Toast.makeText(this@MainActivity, "No se pudo subir la foto del brevete (se guardó el resto del perfil)", Toast.LENGTH_LONG).show()
                        profileToSend = profile.copy(licensePhotoUrl = "")
                    }
                }

                val response = apiService.sendDriverProfile(profileToSend)
                if (!response.isSuccessful) {
                    Toast.makeText(this@MainActivity, "Perfil guardado localmente (sin conexión al servidor)", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Perfil guardado localmente (sin conexión al servidor)", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private suspend fun uploadLicensePhoto(uri: android.net.Uri, apiService: FleetApiService): String? {
        return try {
            val bytes = contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return null
            val mimeType = contentResolver.getType(uri) ?: "image/jpeg"
            val requestBody = bytes.toRequestBody(mimeType.toMediaTypeOrNull())
            val part = MultipartBody.Part.createFormData("photo", "brevete.jpg", requestBody)

            val response = apiService.uploadLicensePhoto(part)
            if (response.isSuccessful) response.body()?.url else null
        } catch (e: Exception) {
            null
        }
    }

    private fun loadDocuments() {
        val vehicleId = driverProfile?.vehicleId ?: return
        isLoadingDocuments = true
        lifecycleScope.launch {
            try {
                val apiService = FleetApiService.create()
                val response = apiService.getDocuments(vehicleId)
                if (response.isSuccessful) {
                    documents = response.body() ?: emptyList()
                } else {
                    Toast.makeText(this@MainActivity, "No se pudieron cargar los documentos", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Sin conexión al servidor de documentos", Toast.LENGTH_SHORT).show()
            } finally {
                isLoadingDocuments = false
            }
        }
    }

    private fun createDocument(document: DigitalDocument) {
        documents = listOf(document) + documents

        lifecycleScope.launch {
            try {
                val apiService = FleetApiService.create()
                val response = apiService.sendDocument(document)
                if (response.isSuccessful) {
                    Toast.makeText(this@MainActivity, "Documento emitido y sincronizado", Toast.LENGTH_SHORT).show()
                } else {
                    Toast.makeText(this@MainActivity, "Documento guardado localmente (error del servidor)", Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Documento guardado localmente (sin conexión)", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun loadAssignedRoute() {
        val vehicleId = driverProfile?.vehicleId ?: return
        lifecycleScope.launch {
            try {
                val apiService = FleetApiService.create()
                val response = apiService.getAssignedRoute(vehicleId)
                if (response.isSuccessful) {
                    assignedRoute = response.body()
                }
            } catch (e: Exception) {
                // Route info is best-effort for the driver's screen; a failed fetch just
                // leaves the "Sin ruta asignada" state, no need to surface an error.
            }
        }
    }

    private fun loadSimulationStatus() {
        val vehicleId = driverProfile?.vehicleId ?: return
        lifecycleScope.launch {
            try {
                val apiService = FleetApiService.create()
                val response = apiService.getRouteSimulationStatus(vehicleId)
                if (response.isSuccessful) {
                    isSimulatingRoute = response.body()?.running ?: false
                }
            } catch (e: Exception) {
                // Estado de simulación es best-effort; si falla, se asume que no está corriendo.
            }
        }
    }

    private fun toggleRouteSimulation() {
        val vehicleId = driverProfile?.vehicleId ?: return
        isSimulationLoading = true
        lifecycleScope.launch {
            try {
                val apiService = FleetApiService.create()
                val response = if (isSimulatingRoute) {
                    apiService.stopRouteSimulation(vehicleId)
                } else {
                    apiService.startRouteSimulation(vehicleId)
                }
                if (response.isSuccessful && response.body()?.success == true) {
                    isSimulatingRoute = !isSimulatingRoute
                } else {
                    Toast.makeText(this@MainActivity, response.body()?.message ?: "No se pudo cambiar la simulación", Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Sin conexión: no se pudo cambiar la simulación", Toast.LENGTH_LONG).show()
            } finally {
                isSimulationLoading = false
            }
        }
    }

    private fun sendAlert(type: AlertType, message: String) {
        val vehicleId = driverProfile?.vehicleId ?: return
        lifecycleScope.launch {
            try {
                val apiService = FleetApiService.create()
                val response = apiService.sendAlert(
                    AlertPayload(vehicleId = vehicleId, type = type.name, message = message, lat = currentLat, lng = currentLng)
                )
                if (response.isSuccessful) {
                    Toast.makeText(this@MainActivity, "Alerta enviada al centro de control", Toast.LENGTH_LONG).show()
                } else {
                    Toast.makeText(this@MainActivity, "No se pudo enviar la alerta", Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Sin conexión: la alerta no se envió", Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onResume() {
        super.onResume()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(
                locationBroadcastReceiver,
                IntentFilter(LocationTrackingService.ACTION_LOCATION_UPDATE),
                RECEIVER_NOT_EXPORTED
            )
        } else {
            registerReceiver(
                locationBroadcastReceiver,
                IntentFilter(LocationTrackingService.ACTION_LOCATION_UPDATE)
            )
        }
    }

    override fun onPause() {
        super.onPause()
        try {
            unregisterReceiver(locationBroadcastReceiver)
        } catch (e: Exception) {
            // Ignored if not registered
        }
    }

    private fun checkAndRequestPermissions() {
        val permissionsToRequest = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissionsToRequest.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val hasLocationPermission = ContextCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        if (hasLocationPermission) {
            startTrackingService()
        } else {
            requestPermissionLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }

    private fun startTrackingService() {
        val profile = driverProfile
        val serviceIntent = Intent(this, LocationTrackingService::class.java).apply {
            action = LocationTrackingService.ACTION_START_TRACKING
            putExtra(LocationTrackingService.EXTRA_VEHICLE_ID, profile?.vehicleId ?: "CAM-101")
            putExtra(LocationTrackingService.EXTRA_DRIVER_NAME, profile?.driverName ?: "Chofer")
            putExtra(LocationTrackingService.EXTRA_PLATE, profile?.plate ?: "")
            putExtra(LocationTrackingService.EXTRA_CARGO_INFO, profile?.cargoType ?: "")
        }
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }
        
        isTrackingActive = true
    }

    private fun stopTrackingService() {
        val serviceIntent = Intent(this, LocationTrackingService::class.java).apply {
            action = LocationTrackingService.ACTION_STOP_TRACKING
        }
        startService(serviceIntent)
        isTrackingActive = false
    }
}
