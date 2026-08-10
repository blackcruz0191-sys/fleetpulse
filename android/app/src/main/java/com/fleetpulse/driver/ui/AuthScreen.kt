package com.fleetpulse.driver.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fleetpulse.driver.ui.theme.*

@Composable
fun AuthScreen(
    isLoading: Boolean,
    errorMessage: String?,
    onLogin: (username: String, password: String) -> Unit,
    onRegister: (username: String, password: String, companyName: String) -> Unit
) {
    var isRegisterTab by remember { mutableStateOf(false) }

    var loginUsername by remember { mutableStateOf("") }
    var loginPassword by remember { mutableStateOf("") }

    var registerCompany by remember { mutableStateOf("") }
    var registerUsername by remember { mutableStateOf("") }
    var registerPassword by remember { mutableStateOf("") }

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedTextColor = TextWhite,
        unfocusedTextColor = TextWhite,
        focusedBorderColor = CyanAccent,
        unfocusedBorderColor = Color.White.copy(alpha = 0.15f),
        focusedLabelColor = CyanAccent,
        unfocusedLabelColor = TextMuted,
        cursorColor = CyanAccent,
        focusedContainerColor = CardNavy,
        unfocusedContainerColor = CardNavy
    )

    Scaffold(containerColor = NavyDark) { padding ->
        Box(
            modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    Icons.Default.SatelliteAlt,
                    contentDescription = null,
                    tint = CyanAccent,
                    modifier = Modifier.size(48.dp)
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(text = "FleetPulse Chofer", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = TextWhite)
                Text(text = "Inicia sesión para transmitir tu jornada", fontSize = 12.sp, color = TextMuted)
                Spacer(modifier = Modifier.height(24.dp))

                // Tabs
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(color = CardNavy, shape = RoundedCornerShape(10.dp))
                        .padding(4.dp)
                ) {
                    AuthTabButton("Iniciar Sesión", !isRegisterTab, Modifier.weight(1f)) { isRegisterTab = false }
                    AuthTabButton("Crear Cuenta", isRegisterTab, Modifier.weight(1f)) { isRegisterTab = true }
                }

                Spacer(modifier = Modifier.height(20.dp))

                if (!isRegisterTab) {
                    OutlinedTextField(
                        value = loginUsername,
                        onValueChange = { loginUsername = it },
                        label = { Text("Usuario") },
                        singleLine = true,
                        colors = fieldColors,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(
                        value = loginPassword,
                        onValueChange = { loginPassword = it },
                        label = { Text("Contraseña") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        colors = fieldColors,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(4.dp))
                    ErrorText(errorMessage)
                    Spacer(modifier = Modifier.height(12.dp))

                    Button(
                        onClick = { onLogin(loginUsername.trim(), loginPassword) },
                        enabled = !isLoading && loginUsername.isNotBlank() && loginPassword.isNotBlank(),
                        colors = ButtonDefaults.buttonColors(containerColor = EmeraldGreen, disabledContainerColor = CardNavy),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth().height(52.dp)
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                        } else {
                            Text(text = "Ingresar", fontWeight = FontWeight.Bold)
                        }
                    }
                } else {
                    OutlinedTextField(
                        value = registerCompany,
                        onValueChange = { registerCompany = it },
                        label = { Text("Empresa / Nombre de Flota") },
                        singleLine = true,
                        colors = fieldColors,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(
                        value = registerUsername,
                        onValueChange = { registerUsername = it },
                        label = { Text("Usuario") },
                        singleLine = true,
                        colors = fieldColors,
                        modifier = Modifier.fillMaxWidth()
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(
                        value = registerPassword,
                        onValueChange = { registerPassword = it },
                        label = { Text("Contraseña (mín. 6 caracteres)") },
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        colors = fieldColors,
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(4.dp))
                    ErrorText(errorMessage)
                    Spacer(modifier = Modifier.height(12.dp))

                    Button(
                        onClick = { onRegister(registerUsername.trim(), registerPassword, registerCompany.trim()) },
                        enabled = !isLoading && registerUsername.isNotBlank() && registerPassword.length >= 6 && registerCompany.isNotBlank(),
                        colors = ButtonDefaults.buttonColors(containerColor = EmeraldGreen, disabledContainerColor = CardNavy),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth().height(52.dp)
                    ) {
                        if (isLoading) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                        } else {
                            Text(text = "Crear Cuenta Gratis", fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AuthTabButton(label: String, selected: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        color = if (selected) EmeraldGreen else Color.Transparent,
        shape = RoundedCornerShape(8.dp),
        modifier = modifier
    ) {
        Text(
            text = label,
            color = if (selected) Color.White else TextMuted,
            fontSize = 13.sp,
            fontWeight = FontWeight.Bold,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            modifier = Modifier.padding(vertical = 10.dp).fillMaxWidth()
        )
    }
}

@Composable
private fun ErrorText(message: String?) {
    if (!message.isNullOrBlank()) {
        Text(text = message, color = CrimsonRed, fontSize = 12.sp)
    }
}
