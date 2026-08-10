package com.fleetpulse.driver.ui

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fleetpulse.driver.model.DigitalDocument
import com.fleetpulse.driver.model.DocumentType
import com.fleetpulse.driver.ui.theme.*

private val docTypeLabels = mapOf(
    DocumentType.FACTURA to "Factura",
    DocumentType.BOLETA to "Boleta",
    DocumentType.GUIA_REMISION to "Guía de Remisión"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DocumentsScreen(
    vehicleId: String,
    documents: List<DigitalDocument>,
    isLoading: Boolean,
    onBack: () -> Unit,
    onCreateDocument: (DigitalDocument) -> Unit,
    onRefresh: () -> Unit
) {
    var showCreateSheet by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(text = "Documentación Digital", fontWeight = FontWeight.Bold, color = TextWhite) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Volver", tint = TextWhite)
                    }
                },
                actions = {
                    IconButton(onClick = onRefresh) {
                        Icon(Icons.Default.Refresh, contentDescription = "Actualizar", tint = TextWhite)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = CardNavy)
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showCreateSheet = true },
                containerColor = EmeraldGreen
            ) {
                Icon(Icons.Default.Add, contentDescription = "Nuevo Documento", tint = Color.White)
            }
        },
        containerColor = NavyDark
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            if (isLoading) {
                LinearProgressIndicator(
                    modifier = Modifier.fillMaxWidth(),
                    color = CyanAccent,
                    trackColor = CardNavy
                )
            }

            if (documents.isEmpty() && !isLoading) {
                Box(modifier = Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.Description,
                            contentDescription = null,
                            tint = TextMuted,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "Aún no hay documentos emitidos para $vehicleId",
                            color = TextMuted,
                            fontSize = 13.sp,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                    }
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(documents) { doc ->
                        DocumentCard(doc)
                    }
                    item { Spacer(modifier = Modifier.height(72.dp)) }
                }
            }
        }
    }

    if (showCreateSheet) {
        NewDocumentSheet(
            vehicleId = vehicleId,
            onDismiss = { showCreateSheet = false },
            onSubmit = { doc ->
                onCreateDocument(doc)
                showCreateSheet = false
            }
        )
    }
}

@Composable
private fun DocumentCard(doc: DigitalDocument) {
    val typeColor = when (doc.docType) {
        DocumentType.FACTURA.name -> CyanAccent
        DocumentType.GUIA_REMISION.name -> EmeraldGreen
        else -> TextMuted
    }
    val typeLabel = docTypeLabels[runCatching { DocumentType.valueOf(doc.docType) }.getOrDefault(DocumentType.BOLETA)] ?: doc.docType

    Card(
        colors = CardDefaults.cardColors(containerColor = CardNavy),
        shape = RoundedCornerShape(14.dp),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(color = typeColor.copy(alpha = 0.15f), shape = RoundedCornerShape(8.dp)) {
                    Text(
                        text = typeLabel.uppercase(),
                        color = typeColor,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
                Text(text = doc.status, color = EmeraldGreen, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }

            Text(text = doc.clientName, color = TextWhite, fontWeight = FontWeight.Bold, fontSize = 15.sp)
            if (doc.deliveryAddress.isNotBlank()) {
                Text(text = doc.deliveryAddress, color = TextMuted, fontSize = 12.sp)
            }
            if (doc.itemsSummary.isNotBlank()) {
                Text(text = doc.itemsSummary, color = TextMuted, fontSize = 12.sp)
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(text = doc.id, color = TextMuted, fontSize = 11.sp)
                if (doc.totalAmount > 0) {
                    Text(text = "S/ %.2f".format(doc.totalAmount), color = TextWhite, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NewDocumentSheet(
    vehicleId: String,
    onDismiss: () -> Unit,
    onSubmit: (DigitalDocument) -> Unit
) {
    var docType by remember { mutableStateOf(DocumentType.GUIA_REMISION) }
    var docTypeExpanded by remember { mutableStateOf(false) }
    var docNumber by remember { mutableStateOf("") }
    var clientName by remember { mutableStateOf("") }
    var clientRuc by remember { mutableStateOf("") }
    var deliveryAddress by remember { mutableStateOf("") }
    var itemsSummary by remember { mutableStateOf("") }
    var totalAmountText by remember { mutableStateOf("") }

    val isFormValid = clientName.isNotBlank() && deliveryAddress.isNotBlank()

    val fieldColors = OutlinedTextFieldDefaults.colors(
        focusedTextColor = TextWhite,
        unfocusedTextColor = TextWhite,
        focusedBorderColor = CyanAccent,
        unfocusedBorderColor = Color.White.copy(alpha = 0.15f),
        focusedLabelColor = CyanAccent,
        unfocusedLabelColor = TextMuted,
        cursorColor = CyanAccent,
        focusedContainerColor = NavyDark,
        unfocusedContainerColor = NavyDark
    )

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = CardNavy
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(text = "Emitir Documento", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = TextWhite)

            ExposedDropdownMenuBox(
                expanded = docTypeExpanded,
                onExpandedChange = { docTypeExpanded = it }
            ) {
                OutlinedTextField(
                    value = docTypeLabels[docType] ?: "",
                    onValueChange = {},
                    readOnly = true,
                    label = { Text("Tipo de Documento") },
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = docTypeExpanded) },
                    colors = fieldColors,
                    modifier = Modifier.fillMaxWidth().menuAnchor()
                )
                ExposedDropdownMenu(expanded = docTypeExpanded, onDismissRequest = { docTypeExpanded = false }) {
                    DocumentType.entries.forEach { type ->
                        DropdownMenuItem(
                            text = { Text(docTypeLabels[type] ?: type.name) },
                            onClick = {
                                docType = type
                                docTypeExpanded = false
                            }
                        )
                    }
                }
            }

            OutlinedTextField(
                value = docNumber,
                onValueChange = { docNumber = it },
                label = { Text("N° de Documento (opcional)") },
                singleLine = true,
                colors = fieldColors,
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = clientName,
                onValueChange = { clientName = it },
                label = { Text("Nombre del Cliente") },
                singleLine = true,
                colors = fieldColors,
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = clientRuc,
                onValueChange = { clientRuc = it },
                label = { Text("RUC / DNI del Cliente") },
                singleLine = true,
                colors = fieldColors,
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = deliveryAddress,
                onValueChange = { deliveryAddress = it },
                label = { Text("Dirección de Entrega") },
                colors = fieldColors,
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = itemsSummary,
                onValueChange = { itemsSummary = it },
                label = { Text("Resumen de Bultos / Productos") },
                colors = fieldColors,
                modifier = Modifier.fillMaxWidth()
            )

            OutlinedTextField(
                value = totalAmountText,
                onValueChange = { input -> totalAmountText = input.filter { it.isDigit() || it == '.' } },
                label = { Text("Monto Total (S/) - opcional") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                colors = fieldColors,
                modifier = Modifier.fillMaxWidth()
            )

            Button(
                onClick = {
                    onSubmit(
                        DigitalDocument(
                            vehicleId = vehicleId,
                            docType = docType.name,
                            docNumber = docNumber.ifBlank { "S/N" },
                            clientName = clientName.trim(),
                            clientRuc = clientRuc.trim(),
                            deliveryAddress = deliveryAddress.trim(),
                            itemsSummary = itemsSummary.trim(),
                            totalAmount = totalAmountText.toDoubleOrNull() ?: 0.0
                        )
                    )
                },
                enabled = isFormValid,
                colors = ButtonDefaults.buttonColors(containerColor = EmeraldGreen, disabledContainerColor = NavyDark),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth().height(52.dp)
            ) {
                Text(text = "Emitir Documento", fontWeight = FontWeight.Bold)
            }

            Spacer(modifier = Modifier.height(8.dp))
        }
    }
}
