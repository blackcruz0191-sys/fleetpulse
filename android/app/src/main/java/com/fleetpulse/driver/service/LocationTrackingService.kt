package com.fleetpulse.driver.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import com.fleetpulse.driver.MainActivity
import com.fleetpulse.driver.data.LocationQueueStore
import com.fleetpulse.driver.model.LocationPayload
import com.fleetpulse.driver.network.FleetApiService
import com.google.android.gms.location.*
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class LocationTrackingService : Service() {

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var locationCallback: LocationCallback
    private lateinit var locationQueue: LocationQueueStore

    private var vehicleId: String = "CAM-101" // Default assigned vehicle
    private var driverName: String = "Chofer"
    private var plate: String = ""
    private var cargoInfo: String = ""

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        locationQueue = LocationQueueStore(this)

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { location ->
                    val payload = LocationPayload(
                        vehicleId = vehicleId,
                        plate = plate.ifBlank { "ABC-101" },
                        driverName = driverName,
                        cargoInfo = cargoInfo.ifBlank { "Sin especificar" },
                        latitude = location.latitude,
                        longitude = location.longitude,
                        speedKmh = location.speed * 3.6f, // m/s to km/h
                        heading = location.bearing,
                        accuracyMeters = location.accuracy
                    )
                    
                    Log.d(TAG, "GPS Update: Lat=${payload.latitude}, Lng=${payload.longitude}, Speed=${payload.speedKmh} km/h")
                    
                    // Broadcast location locally for UI updates
                    sendBroadcast(Intent(ACTION_LOCATION_UPDATE).apply {
                        putExtra(EXTRA_LAT, payload.latitude)
                        putExtra(EXTRA_LNG, payload.longitude)
                        putExtra(EXTRA_SPEED, payload.speedKmh)
                    })

                    // Post to remote server
                    postLocationToServer(payload)
                }
            }
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START_TRACKING -> {
                vehicleId = intent.getStringExtra(EXTRA_VEHICLE_ID) ?: "CAM-101"
                driverName = intent.getStringExtra(EXTRA_DRIVER_NAME) ?: "Chofer"
                plate = intent.getStringExtra(EXTRA_PLATE) ?: ""
                cargoInfo = intent.getStringExtra(EXTRA_CARGO_INFO) ?: ""
                startForegroundServiceWithNotification()
                startLocationUpdates()
            }
            ACTION_STOP_TRACKING -> {
                stopLocationUpdates()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
        return START_STICKY
    }

    private fun startForegroundServiceWithNotification() {
        createNotificationChannel()

        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("FleetPulse - Rastreando Ubicación")
            .setContentText("Servicio de telemetría en tiempo real activo ($vehicleId)")
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun startLocationUpdates() {
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            UPDATE_INTERVAL_MS
        ).apply {
            setMinUpdateIntervalMillis(FASTEST_UPDATE_INTERVAL_MS)
            setWaitForAccurateLocation(false)
        }.build()

        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
        } catch (e: SecurityException) {
            Log.e(TAG, "Permisos de ubicación no otorgados: ${e.message}")
        }
    }

    private fun stopLocationUpdates() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
    }

    // Sends a single ping; returns whether it reached the server. Network failures and
    // HTTP errors are treated the same here — either way the point wasn't delivered.
    private suspend fun sendOne(payload: LocationPayload): Boolean {
        return try {
            val apiService = FleetApiService.create()
            val response = apiService.sendLocationUpdate(payload)
            response.isSuccessful
        } catch (e: Exception) {
            false
        }
    }

    // Drains whatever built up while offline, oldest first, so the route history on
    // the dashboard doesn't jump around out of order. Stops at the first failure —
    // still offline — and tries again on the next GPS tick instead of looping here.
    private suspend fun flushQueuedLocations() {
        while (locationQueue.size() > 0) {
            val oldest = locationQueue.getAll().firstOrNull() ?: return
            if (sendOne(oldest)) {
                locationQueue.removeFirst()
            } else {
                return
            }
        }
    }

    private fun postLocationToServer(payload: LocationPayload) {
        serviceScope.launch {
            flushQueuedLocations()

            val delivered = sendOne(payload)
            if (delivered) {
                Log.i(TAG, "GPS enviado con éxito a la API Backend")
            } else {
                // Sin conexión (o el servidor no respondió) — se guarda para reintentar
                // en el siguiente tick, en vez de perder este punto de la ruta.
                locationQueue.enqueue(payload)
                Log.w(TAG, "Sin conexión: posición encolada (${locationQueue.size()} pendiente(s))")
            }

            sendBroadcast(Intent(ACTION_QUEUE_UPDATE).apply {
                putExtra(EXTRA_QUEUE_SIZE, locationQueue.size())
            })
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "FleetPulse Tracking Channel",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Notificación persistente de seguimiento GPS para el chofer"
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        stopLocationUpdates()
        serviceScope.cancel()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val TAG = "LocationTrackingService"
        const val CHANNEL_ID = "fleet_tracking_channel"
        const val NOTIFICATION_ID = 1001

        const val ACTION_START_TRACKING = "ACTION_START_TRACKING"
        const val ACTION_STOP_TRACKING = "ACTION_STOP_TRACKING"
        const val ACTION_LOCATION_UPDATE = "ACTION_LOCATION_UPDATE"
        const val ACTION_QUEUE_UPDATE = "ACTION_QUEUE_UPDATE"

        const val EXTRA_VEHICLE_ID = "EXTRA_VEHICLE_ID"
        const val EXTRA_DRIVER_NAME = "EXTRA_DRIVER_NAME"
        const val EXTRA_PLATE = "EXTRA_PLATE"
        const val EXTRA_CARGO_INFO = "EXTRA_CARGO_INFO"
        const val EXTRA_LAT = "EXTRA_LAT"
        const val EXTRA_LNG = "EXTRA_LNG"
        const val EXTRA_SPEED = "EXTRA_SPEED"
        const val EXTRA_QUEUE_SIZE = "EXTRA_QUEUE_SIZE"

        private const val UPDATE_INTERVAL_MS = 3000L
        private const val FASTEST_UPDATE_INTERVAL_MS = 1500L
    }
}
