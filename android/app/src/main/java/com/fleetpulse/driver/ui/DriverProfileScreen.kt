package com.fleetpulse.driver.ui

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fleetpulse.driver.model.DriverProfile
import com.fleetpulse.driver.ui.theme.*

private val licenseCategories = listOf(
    "A-I", "A-IIa", "A-IIb", "A-IIIa", "A-IIIb", "A-IIIc", "B-I", "B-IIa", "B-IIb"
)

private val cargoTypes = listOf(
    "Productos Perecederos",
    "Carga General",
    "Materiales de Construcción",
    "Electrodomésticos",
    "Combustible / Líquidos",
    "Paquetería y Encomiendas"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DriverProfileScreen(
    initialProfile: DriverProfile?,
    isFirstLaunch: Boolean,
    onSave: (DriverProfile) -> Unit,
    onCancel: () -> Unit
) {
    var vehicleId by remember { mutableStateOf(initialProfile?.vehicleId ?: "CAM-101") }
    var plate by remember { mutableStateOf(initialProfile?.plate ?: "") }
    var driverName by remember { mutableStateOf(initialProfile?.driverName ?: "") }
    var driverPhone by remember { mutableStateOf(initialProfile?.driverPhone ?: "") }
    var vehicleModel by remember { mutableStateOf(initialProfile?.vehicleModel ?: "") }
    var cargoWeightText by remember { mutableStateOf(initialProfile?.cargoWeightKg?.takeIf { it > 0f }?.toString() ?: "") }
    var cargoType by remember { mutableStateOf(initialProfile?.cargoType ?: cargoTypes.first()) }
    var cargoDropdownExpanded by remember { mutableStateOf(false) }

    var licenseNumber by remember { mutableStateOf(initialProfile?.licenseNumber ?: "") }
    var licenseCategory by remember { mutableStateOf(initialProfile?.licenseCategory ?: "") }
    var licenseCategoryExpanded by remember { mutableStateOf(false) }
    var licenseIssueDate by remember { mutableStateOf(initialProfile?.licenseIssueDate ?: "") }
    var licenseExpiryDate by remember { mutableStateOf(initialProfile?.licenseExpiryDate ?: "") }
    var licenseRestrictions by remember { mutableStateOf(initialProfile?.licenseRestrictions ?: "") }
    var licenseInfractions by remember { mutableStateOf(initialProfile?.licenseInfractions ?: "") }
    var licensePhotoUri by remember { mutableStateOf(initialProfile?.licensePhotoUrl ?: "") }

    val context = LocalContext.current
    val photoPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) {
            try {
                context.contentResolver.takePersistableUriPermission(
                    uri, android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            } catch (e: SecurityException) {
                // Some providers don't support persistable permissions; the URI still
                // works for this session, it just won't survive an app restart.
            }
            licensePhotoUri = uri.toString()
        }
    }

    val isFormValid = driverName.isNotBlank() && plate.isNotBlank() &&
        vehicleModel.isNotBlank() && vehicleId.isNotBlank()

    // El botón/gesto físico de retroceso de Android hace lo mismo que la flecha del
    // encabezado, para que salir de esta pantalla nunca se sienta "atascado".
    BackHandler(onBack = onCancel)

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

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = if (isFirstLaunch) "Bienvenido a FleetPulse" else "Perfil y Vehículo",
                        fontWeight = FontWeight.Bold,
                        color = TextWhite
                    )
                },
                navigationIcon = {
                    // Always available — on first launch there's no profile to fall back to,
                    // so "volver" here means cerrar sesión instead of just closing the form
                    // (MainActivity decides which, based on whether a profile already exists).
                    IconButton(onClick = onCancel) {
                        Icon(
                            Icons.Default.ArrowBack,
                            contentDescription = if (isFirstLaunch) "Cerrar sesión" else "Volver",
                            tint = TextWhite
                        )
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
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            if (isFirstLaunch) {
                Text(
                    text = "Antes de salir a ruta, configura tus datos de chofer y vehículo.",
                    color = TextMuted,
                    fontSize = 13.sp
                )
                Text(
                    text = "Puedes tocar la flecha de arriba para cerrar sesión y volver más tarde.",
                    color = TextMuted,
                    fontSize = 11.sp
                )
            }

            Card(
                colors = CardDefaults.cardColors(containerColor = CardNavy),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    SectionLabel("Datos del Chofer")

                    OutlinedTextField(
                        value = driverName,
                        onValueChange = { driverName = it },
                        label = { Text("Nombre del Chofer") },
                        leadingIcon = { Icon(Icons.Default.Person, contentDescription = null, tint = TextMuted) },
                        singleLine = true,
                        colors = fieldColors,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = driverPhone,
                        onValueChange = { driverPhone = it },
                        label = { Text("Teléfono de Contacto") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                        colors = fieldColors,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            Card(
                colors = CardDefaults.cardColors(containerColor = CardNavy),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    SectionLabel("Datos del Vehículo")

                    OutlinedTextField(
                        value = vehicleId,
                        onValueChange = { vehicleId = it.uppercase() },
                        label = { Text("ID de Vehículo (ej. CAM-101)") },
                        singleLine = true,
                        colors = fieldColors,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = vehicleModel,
                        onValueChange = { vehicleModel = it },
                        label = { Text("Modelo del Vehículo") },
                        singleLine = true,
                        colors = fieldColors,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = plate,
                        onValueChange = { plate = it.uppercase() },
                        label = { Text("Placa") },
                        singleLine = true,
                        colors = fieldColors,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            Card(
                colors = CardDefaults.cardColors(containerColor = CardNavy),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    SectionLabel("Datos de Carga")

                    ExposedDropdownMenuBox(
                        expanded = cargoDropdownExpanded,
                        onExpandedChange = { cargoDropdownExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = cargoType,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Tipo de Carga") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = cargoDropdownExpanded) },
                            colors = fieldColors,
                            modifier = Modifier
                                .fillMaxWidth()
                                .menuAnchor()
                        )
                        ExposedDropdownMenu(
                            expanded = cargoDropdownExpanded,
                            onDismissRequest = { cargoDropdownExpanded = false }
                        ) {
                            cargoTypes.forEach { option ->
                                DropdownMenuItem(
                                    text = { Text(option) },
                                    onClick = {
                                        cargoType = option
                                        cargoDropdownExpanded = false
                                    }
                                )
                            }
                        }
                    }

                    OutlinedTextField(
                        value = cargoWeightText,
                        onValueChange = { input -> cargoWeightText = input.filter { it.isDigit() || it == '.' } },
                        label = { Text("Peso de Carga (kg) - opcional") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                        colors = fieldColors,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }

            Card(
                colors = CardDefaults.cardColors(containerColor = CardNavy),
                shape = RoundedCornerShape(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    SectionLabel("Brevete (Licencia de Conducir)")

                    OutlinedTextField(
                        value = licenseNumber,
                        onValueChange = { licenseNumber = it },
                        label = { Text("N° de Brevete") },
                        singleLine = true,
                        colors = fieldColors,
                        modifier = Modifier.fillMaxWidth()
                    )

                    ExposedDropdownMenuBox(
                        expanded = licenseCategoryExpanded,
                        onExpandedChange = { licenseCategoryExpanded = it }
                    ) {
                        OutlinedTextField(
                            value = licenseCategory,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Categoría") },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = licenseCategoryExpanded) },
                            colors = fieldColors,
                            modifier = Modifier.fillMaxWidth().menuAnchor()
                        )
                        ExposedDropdownMenu(
                            expanded = licenseCategoryExpanded,
                            onDismissRequest = { licenseCategoryExpanded = false }
                        ) {
                            licenseCategories.forEach { option ->
                                DropdownMenuItem(
                                    text = { Text(option) },
                                    onClick = { licenseCategory = option; licenseCategoryExpanded = false }
                                )
                            }
                        }
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = licenseIssueDate,
                            onValueChange = { licenseIssueDate = it },
                            label = { Text("Emisión (AAAA-MM-DD)") },
                            singleLine = true,
                            colors = fieldColors,
                            modifier = Modifier.weight(1f)
                        )
                        OutlinedTextField(
                            value = licenseExpiryDate,
                            onValueChange = { licenseExpiryDate = it },
                            label = { Text("Vence (AAAA-MM-DD)") },
                            singleLine = true,
                            colors = fieldColors,
                            modifier = Modifier.weight(1f)
                        )
                    }

                    OutlinedTextField(
                        value = licenseRestrictions,
                        onValueChange = { licenseRestrictions = it },
                        label = { Text("Restricciones") },
                        singleLine = true,
                        colors = fieldColors,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedTextField(
                        value = licenseInfractions,
                        onValueChange = { licenseInfractions = it },
                        label = { Text("Record de Infracciones") },
                        singleLine = true,
                        colors = fieldColors,
                        modifier = Modifier.fillMaxWidth()
                    )

                    OutlinedButton(
                        onClick = {
                            photoPickerLauncher.launch(
                                androidx.activity.result.PickVisualMediaRequest(
                                    ActivityResultContracts.PickVisualMedia.ImageOnly
                                )
                            )
                        },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.CameraAlt, contentDescription = null, tint = CyanAccent)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(if (licensePhotoUri.isBlank()) "Adjuntar Foto del Brevete" else "Foto seleccionada ✓ (cambiar)")
                    }
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            Button(
                onClick = {
                    onSave(
                        DriverProfile(
                            vehicleId = vehicleId.trim(),
                            plate = plate.trim(),
                            driverName = driverName.trim(),
                            driverPhone = driverPhone.trim().ifBlank { "+51 900 000 000" },
                            vehicleModel = vehicleModel.trim(),
                            cargoType = cargoType,
                            cargoWeightKg = cargoWeightText.toFloatOrNull() ?: 0f,
                            licenseNumber = licenseNumber.trim(),
                            licenseCategory = licenseCategory,
                            licenseIssueDate = licenseIssueDate.trim(),
                            licenseExpiryDate = licenseExpiryDate.trim(),
                            licensePhotoUrl = licensePhotoUri,
                            licenseRestrictions = licenseRestrictions.trim(),
                            licenseInfractions = licenseInfractions.trim()
                        )
                    )
                },
                enabled = isFormValid,
                colors = ButtonDefaults.buttonColors(
                    containerColor = EmeraldGreen,
                    disabledContainerColor = CardNavy
                ),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
            ) {
                Text(
                    text = if (isFirstLaunch) "Guardar y Empezar Jornada" else "Guardar Cambios",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
            }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text = text,
        fontSize = 14.sp,
        fontWeight = FontWeight.Bold,
        color = TextMuted
    )
}
