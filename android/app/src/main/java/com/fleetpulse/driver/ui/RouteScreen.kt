package com.fleetpulse.driver.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.fleetpulse.driver.model.AssignedRoute
import com.fleetpulse.driver.ui.theme.*
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

private fun haversineKm(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
    val earthRadiusKm = 6371.0
    val dLat = Math.toRadians(lat2 - lat1)
    val dLng = Math.toRadians(lng2 - lng1)
    val a = sin(dLat / 2) * sin(dLat / 2) +
        cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLng / 2) * sin(dLng / 2)
    val c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return earthRadiusKm * c
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RouteScreen(
    route: AssignedRoute?,
    currentLatitude: Double,
    currentLongitude: Double,
    onBack: () -> Unit,
    onRefresh: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(text = "Mi Ruta", fontWeight = FontWeight.Bold, color = TextWhite) },
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
        containerColor = NavyDark
    ) { padding ->
        if (route == null || route.stops.isEmpty()) {
            Box(modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.Route, contentDescription = null, tint = TextMuted, modifier = Modifier.size(48.dp))
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(text = "El centro de control aún no te asignó una ruta", color = TextMuted, fontSize = 13.sp)
                }
            }
            return@Scaffold
        }

        val distances = buildList {
            var prevLat = currentLatitude
            var prevLng = currentLongitude
            route.stops.forEach { stop ->
                add(haversineKm(prevLat, prevLng, stop.lat, stop.lng))
                prevLat = stop.lat
                prevLng = stop.lng
            }
        }
        val totalKm = distances.sum()

        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            Card(
                colors = CardDefaults.cardColors(containerColor = CardNavy),
                shape = RoundedCornerShape(0.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = route.stops.size.toString(), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = CyanAccent)
                        Text(text = "Paradas", fontSize = 11.sp, color = TextMuted)
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(text = "%.1f km".format(totalKm), fontSize = 20.sp, fontWeight = FontWeight.Bold, color = EmeraldGreen)
                        Text(text = "Distancia en línea recta", fontSize = 11.sp, color = TextMuted)
                    }
                }
            }

            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(0.dp)
            ) {
                itemsIndexed(route.stops, distances) { index, stop, distKm ->
                    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(28.dp)) {
                            Box(
                                modifier = Modifier
                                    .size(24.dp)
                                    .background(color = Color(0xFFF59E0B), shape = CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(text = "${index + 1}", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                            if (index < route.stops.size - 1) {
                                Box(
                                    modifier = Modifier
                                        .width(2.dp)
                                        .height(36.dp)
                                        .background(Color(0xFFF59E0B).copy(alpha = 0.4f))
                                )
                            }
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(text = stop.label, color = TextWhite, fontWeight = FontWeight.Bold, fontSize = 15.sp)
                            Text(text = "%.1f km desde el punto anterior".format(distKm), color = TextMuted, fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}

private fun <T, U> androidx.compose.foundation.lazy.LazyListScope.itemsIndexed(
    listA: List<T>,
    listB: List<U>,
    itemContent: @Composable (Int, T, U) -> Unit
) {
    items(listA.size) { index ->
        itemContent(index, listA[index], listB[index])
    }
}
