package com.fleetpulse.driver.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fleetpulse.driver.ui.theme.*

// Pantalla que ve un usuario con rol "admin" al iniciar sesión en la app del chofer.
// La gestión completa de la flota (mapa en vivo, choferes, rutas, documentos, alertas)
// vive en el dashboard web — aquí solo se confirma la cuenta y se enlaza a ese panel,
// en vez de forzar el flujo de perfil de chofer/vehículo que no le corresponde.
@Composable
fun AdminHomeScreen(
    username: String?,
    companyName: String?,
    onOpenDashboard: () -> Unit,
    onLogout: () -> Unit
) {
    Scaffold(containerColor = NavyDark) { padding ->
        Box(
            modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier.size(72.dp).background(color = CardNavy, shape = CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(Icons.Default.AdminPanelSettings, contentDescription = null, tint = CyanAccent, modifier = Modifier.size(36.dp))
                }
                Spacer(modifier = Modifier.height(16.dp))
                Text(text = companyName?.takeIf { it.isNotBlank() } ?: (username ?: "Administrador"), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = TextWhite)
                Text(text = "Cuenta de Administrador de Flota", fontSize = 13.sp, color = TextMuted)

                Spacer(modifier = Modifier.height(28.dp))

                Card(
                    colors = CardDefaults.cardColors(containerColor = CardNavy),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text(
                            text = "La gestión de tu flota — mapa en vivo, choferes, rutas, documentos y alertas — se hace desde el dashboard web.",
                            fontSize = 13.sp,
                            color = TextMuted,
                            textAlign = TextAlign.Start
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Button(
                            onClick = onOpenDashboard,
                            colors = ButtonDefaults.buttonColors(containerColor = EmeraldGreen),
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.fillMaxWidth().height(52.dp)
                        ) {
                            Icon(Icons.Default.OpenInBrowser, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(text = "Abrir Dashboard Web", fontWeight = FontWeight.Bold)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))

                TextButton(onClick = onLogout) {
                    Text(text = "Cerrar Sesión", color = CrimsonRed, fontSize = 13.sp)
                }
            }
        }
    }
}
