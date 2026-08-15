package com.fleetpulse.driver.model

import com.google.gson.annotations.SerializedName

data class LocationPayload(
    @SerializedName("vehicle_id") val vehicleId: String,
    @SerializedName("plate") val plate: String = "ABC-101",
    @SerializedName("driver_name") val driverName: String = "Carlos Mendoza",
    @SerializedName("cargo_info") val cargoInfo: String = "Productos Perecederos",
    @SerializedName("latitude") val latitude: Double,
    @SerializedName("longitude") val longitude: Double,
    @SerializedName("speed_kmh") val speedKmh: Float,
    @SerializedName("heading") val heading: Float,
    @SerializedName("accuracy_meters") val accuracyMeters: Float,
    @SerializedName("battery_level") val batteryLevel: Int = 98,
    @SerializedName("fuel_level") val fuelLevel: Float = 85f,
    @SerializedName("timestamp") val timestamp: Long = System.currentTimeMillis()
)

data class DriverProfile(
    @SerializedName("vehicle_id") val vehicleId: String,
    @SerializedName("plate") val plate: String,
    @SerializedName("driver_name") val driverName: String,
    @SerializedName("driver_phone") val driverPhone: String = "+51 987 123 456",
    @SerializedName("vehicle_model") val vehicleModel: String,
    @SerializedName("cargo_type") val cargoType: String,
    @SerializedName("cargo_weight_kg") val cargoWeightKg: Float,
    @SerializedName("license_number") val licenseNumber: String = "",
    @SerializedName("license_category") val licenseCategory: String = "",
    @SerializedName("license_issue_date") val licenseIssueDate: String = "",
    @SerializedName("license_expiry_date") val licenseExpiryDate: String = "",
    @SerializedName("license_photo_url") val licensePhotoUrl: String = "",
    @SerializedName("license_restrictions") val licenseRestrictions: String = "",
    @SerializedName("license_infractions") val licenseInfractions: String = ""
)

data class RouteStop(
    @SerializedName("label") val label: String,
    @SerializedName("lat") val lat: Double,
    @SerializedName("lng") val lng: Double
)

data class AssignedRoute(
    @SerializedName("id") val id: String,
    @SerializedName("vehicleId") val vehicleId: String,
    @SerializedName("stops") val stops: List<RouteStop>,
    @SerializedName("createdAt") val createdAt: Long
)

enum class AlertType {
    FUEL_STOP,
    EMERGENCY,
    BREAKDOWN,
    DRIVER_CHANGE
}

data class UploadResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String?,
    @SerializedName("url") val url: String?
)

data class AlertPayload(
    @SerializedName("vehicle_id") val vehicleId: String,
    @SerializedName("type") val type: String,
    @SerializedName("message") val message: String = "",
    @SerializedName("lat") val lat: Double? = null,
    @SerializedName("lng") val lng: Double? = null
)

enum class DocumentType {
    FACTURA,
    BOLETA,
    GUIA_REMISION
}

data class DigitalDocument(
    @SerializedName("id") val id: String = "DOC-" + System.currentTimeMillis().toString().takeLast(6),
    @SerializedName("vehicle_id") val vehicleId: String,
    @SerializedName("doc_type") val docType: String, // FACTURA, BOLETA, GUIA_REMISION
    @SerializedName("doc_number") val docNumber: String,
    @SerializedName("client_name") val clientName: String,
    @SerializedName("client_ruc") val clientRuc: String,
    @SerializedName("delivery_address") val deliveryAddress: String,
    @SerializedName("items_summary") val itemsSummary: String,
    @SerializedName("total_amount") val totalAmount: Double,
    @SerializedName("status") val status: String = "EMITIDO",
    @SerializedName("created_at") val createdAt: Long = System.currentTimeMillis()
)

data class TelemetryStatus(
    @SerializedName("vehicle_id") val vehicleId: String,
    @SerializedName("battery_level") val batteryLevel: Int,
    @SerializedName("fuel_level") val fuelLevel: Float,
    @SerializedName("engine_temp") val engineTemp: Float,
    @SerializedName("odometer_km") val odometerKm: Float,
    @SerializedName("timestamp") val timestamp: Long = System.currentTimeMillis()
)

data class ApiResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String
)

data class SimulationStatus(
    @SerializedName("running") val running: Boolean
)

data class LoginRequest(
    @SerializedName("username") val username: String,
    @SerializedName("password") val password: String
)

data class RegisterRequest(
    @SerializedName("username") val username: String,
    @SerializedName("password") val password: String,
    @SerializedName("company_name") val companyName: String,
    @SerializedName("role") val role: String = "driver"
)

data class AuthUser(
    @SerializedName("id") val id: Int,
    @SerializedName("username") val username: String,
    @SerializedName("companyName") val companyName: String?,
    @SerializedName("role") val role: String? = null,
    @SerializedName("driverCode") val driverCode: String? = null
)

data class AuthResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String?,
    @SerializedName("token") val token: String?,
    @SerializedName("user") val user: AuthUser?
)
