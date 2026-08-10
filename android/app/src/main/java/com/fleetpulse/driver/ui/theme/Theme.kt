package com.fleetpulse.driver.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val NavyDark = Color(0xFF0A0E17)
val CardNavy = Color(0xFF121A2B)
val CyanAccent = Color(0xFF06B6D4)
val EmeraldGreen = Color(0xFF10B981)
val CrimsonRed = Color(0xFFEF4444)
val TextWhite = Color(0xFFF1F5F9)
val TextMuted = Color(0xFF94A3B8)

private val DarkColorScheme = darkColorScheme(
    primary = CyanAccent,
    secondary = EmeraldGreen,
    tertiary = CrimsonRed,
    background = NavyDark,
    surface = CardNavy,
    onPrimary = Color.White,
    onBackground = TextWhite,
    onSurface = TextWhite
)

@Composable
fun FleetPulseTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = Typography(),
        content = content
    )
}
