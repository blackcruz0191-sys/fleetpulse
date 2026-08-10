package com.fleetpulse.driver.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fleetpulse.driver.model.AlertType
import com.fleetpulse.driver.model.AssignedRoute
import com.fleetpulse.driver.ui.theme.*

private data class AlertOption(val type: AlertType, val label: String, val icon: androidx.compose.ui.graphics.vector.ImageVector, val color: Color)

private val alertOptions = listOf(
    AlertOption(AlertType.FUEL_STOP, "Combustible", Icons.Default.LocalGasStation, CyanAccent),
    AlertOption(AlertType.BREAKDOWN, "Vehículo Averiado", Icons.Default.CarCrash, Color(0xFFF59E0B)),
    AlertOption(AlertType.DRIVER_CHANGE, "Cambio de Chofer", Icons.Default.SwapHoriz, EmeraldGreen)
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DriverDashboardScreen(
    driverName: String,
    vehicleLabel: String,
    isTrackingActive: Boolean,
    currentLatitude: Double,
    currentLongitude: Double,
    currentSpeedKmh: Float,
    assignedRoute: AssignedRoute?,
    onToggleDuty: (Boolean) -> Unit,
    onSendAlert: (AlertType, String) -> Unit,
    onOpenProfile: () -> Unit,
    onOpenDocuments: () -> Unit,
    onOpenRoute: () -> Unit,
    onLogout: () -> Unit
) {
    var showSosDialog by remember { mutableStateOf(false) }
    var pendingAlert by remember { mutableStateOf<AlertOption?>(null) }
    var alertMessage by remember { mutableStateOf("") }

    val statusColor by animateColorAsState(
        if (isTrackingActive) EmeraldGreen else Color.Gray,
        label = "statusColor"
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "FleetPulse Chofer · $driverName",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = TextWhite
                        )
                        Text(
                            text = vehicleLabel,
                            fontSize = 12.sp,
                            color = TextMuted
                        )
                    }
                },
                actions = {
                    IconButton(onClick = onOpenDocuments) {
                        Icon(Icons.Default.Description, contentDescription = "Documentación Digital", tint = TextWhite)
                    }
                    IconButton(onClick = onOpenProfile) {
                        Icon(Icons.Default.Person, contentDescription = "Perfil y Vehículo", tint = TextWhite)
                    }
                    IconButton(onClick = onLogout) {
                        Icon(Icons.Default.Logout, contentDescription = "Cerrar Sesión", tint = TextWhite)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = CardNavy)
            )
        },
        containerColor = NavyDark
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {

            // 1. On-Duty Status Switch Card
            Card(
                colors = CardDefaults.cardColors(containerColor = CardNavy),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(16.dp)
                                .clip(CircleShape)
                                .background(statusColor)
                        )
                        Column {
                            Text(
                                text = if (isTrackingActive) "EN JORNADA (Transmitiendo GPS)" else "FUERA DE SERVICE",
                                fontWeight = FontWeight.Bold,
                                color = TextWhite,
                                fontSize = 14.sp
                            )
                            Text(
                                text = if (isTrackingActive) "Rastreando ubicación en segundo plano" else "Presiona para activar seguimiento",
                                color = TextMuted,
                                fontSize = 12.sp
                            )
                        }
                    }

                    Switch(
                        checked = isTrackingActive,
                        onCheckedChange = { onToggleDuty(it) },
                        colors = SwitchDefaults.colors(
                            checkedThumbColor = Color.White,
                            checkedTrackColor = EmeraldGreen,
                            uncheckedThumbColor = Color.Gray,
                            uncheckedTrackColor = CardNavy
                        )
                    )
                }
            }

            // 2. Real-Time Telemetry & Speed Gauges
            Card(
                colors = CardDefaults.cardColors(containerColor = CardNavy),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Text(
                        text = "Telemetría en Vivo",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextMuted
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceAround,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Speed Gauge
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "%.0f".format(currentSpeedKmh),
                                fontSize = 36.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = CyanAccent
                            )
                            Text(text = "km/h Velocidad", fontSize = 12.sp, color = TextMuted)
                        }

                        Divider(
                            modifier = Modifier
                                .height(50.dp)
                                .width(1.dp),
                            color = Color.White.copy(alpha = 0.1f)
                        )

                        // Battery / Signal
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Default.BatteryFull, contentDescription = null, tint = EmeraldGreen)
                                Spacer(modifier = Modifier.width(4.dp))
                                Text(text = "98%", fontWeight = FontWeight.Bold, color = TextWhite)
                            }
                            Text(text = "Batería", fontSize = 12.sp, color = TextMuted)
                        }
                    }

                    // GPS Coordinates detail
                    Surface(
                        color = NavyDark.copy(alpha = 0.5f),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(10.dp),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Lat: %.6f".format(currentLatitude),
                                fontSize = 12.sp,
                                color = TextMuted
                            )
                            Text(
                                text = "Lng: %.6f".format(currentLongitude),
                                fontSize = 12.sp,
                                color = TextMuted
                            )
                        }
                    }
                }
            }

            // 3. Current Route & Navigation Destination
            Card(
                colors = CardDefaults.cardColors(containerColor = CardNavy),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth(),
                onClick = onOpenRoute
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    Icon(
                        Icons.Default.Navigation,
                        contentDescription = null,
                        tint = CyanAccent,
                        modifier = Modifier.size(32.dp)
                    )
                    Column(modifier = Modifier.weight(1f)) {
                        if (assignedRoute != null && assignedRoute.stops.isNotEmpty()) {
                            Text(text = "Ruta Asignada · ${assignedRoute.stops.size} parada(s)", fontSize = 12.sp, color = TextMuted)
                            Text(
                                text = assignedRoute.stops.first().label,
                                fontWeight = FontWeight.Bold,
                                color = TextWhite,
                                fontSize = 16.sp
                            )
                            if (assignedRoute.stops.size > 1) {
                                Text(
                                    text = "Siguiente: ${assignedRoute.stops.getOrNull(1)?.label ?: "—"}",
                                    fontSize = 12.sp,
                                    color = EmeraldGreen
                                )
                            }
                        } else {
                            Text(text = "Sin ruta asignada", fontWeight = FontWeight.Bold, color = TextWhite, fontSize = 16.sp)
                            Text(text = "El centro de control aún no te asignó paradas", fontSize = 12.sp, color = TextMuted)
                        }
                    }
                    Icon(
                        Icons.Default.ChevronRight,
                        contentDescription = "Ver ruta completa",
                        tint = TextMuted,
                        modifier = Modifier.size(20.dp)
                    )
                }
            }

            // 4. Quick Operational Alerts
            Card(
                colors = CardDefaults.cardColors(containerColor = CardNavy),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(text = "Alertas Operativas", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = TextMuted)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        alertOptions.forEach { option ->
                            OutlinedButton(
                                onClick = { pendingAlert = option; alertMessage = "" },
                                modifier = Modifier.weight(1f).height(64.dp),
                                contentPadding = PaddingValues(4.dp)
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Icon(option.icon, contentDescription = option.label, tint = option.color, modifier = Modifier.size(20.dp))
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(text = option.label, fontSize = 9.sp, color = TextMuted, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                                }
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.weight(1f))

            // 5. Panic SOS Button
            Button(
                onClick = { showSosDialog = true },
                colors = ButtonDefaults.buttonColors(containerColor = CrimsonRed),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
            ) {
                Icon(Icons.Default.Warning, contentDescription = null, tint = Color.White)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "EMERGENCIA SOS",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = Color.White
                )
            }
        }
    }

    // SOS Confirmation Dialog
    if (showSosDialog) {
        AlertDialog(
            onDismissRequest = { showSosDialog = false },
            title = { Text(text = "Confirmar Alerta SOS", fontWeight = FontWeight.Bold) },
            text = { Text(text = "¿Deseas notificar inmediatamente al centro de mando sobre una situación de emergencia?") },
            confirmButton = {
                Button(
                    onClick = {
                        showSosDialog = false
                        onSendAlert(AlertType.EMERGENCY, "Alerta SOS activada por el chofer")
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = CrimsonRed)
                ) {
                    Text("ENVIAR ALERTA YA")
                }
            },
            dismissButton = {
                TextButton(onClick = { showSosDialog = false }) {
                    Text("Cancelar")
                }
            }
        )
    }

    // Quick Alert Confirmation Dialog (Combustible / Avería / Cambio de Chofer)
    pendingAlert?.let { option ->
        AlertDialog(
            onDismissRequest = { pendingAlert = null },
            title = { Text(text = option.label, fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text(text = "Se notificará al centro de control en tiempo real.")
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = alertMessage,
                        onValueChange = { alertMessage = it },
                        label = { Text("Comentario (opcional)") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        onSendAlert(option.type, alertMessage)
                        pendingAlert = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = option.color)
                ) {
                    Text("Enviar")
                }
            },
            dismissButton = {
                TextButton(onClick = { pendingAlert = null }) {
                    Text("Cancelar")
                }
            }
        )
    }
}
