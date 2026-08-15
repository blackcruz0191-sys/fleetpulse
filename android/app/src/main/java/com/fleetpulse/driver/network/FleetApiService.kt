package com.fleetpulse.driver.network

import com.fleetpulse.driver.data.SessionManager
import com.fleetpulse.driver.model.AlertPayload
import com.fleetpulse.driver.model.ApiResponse
import com.fleetpulse.driver.model.AssignedRoute
import com.fleetpulse.driver.model.AuthResponse
import com.fleetpulse.driver.model.DigitalDocument
import com.fleetpulse.driver.model.DriverProfile
import com.fleetpulse.driver.model.LocationPayload
import com.fleetpulse.driver.model.LoginRequest
import com.fleetpulse.driver.model.RegisterRequest
import com.fleetpulse.driver.model.RemoteVehicle
import com.fleetpulse.driver.model.SimulationStatus
import com.fleetpulse.driver.model.TelemetryStatus
import com.fleetpulse.driver.model.UploadResponse
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path

interface FleetApiService {

    @POST("api/v1/auth/register")
    suspend fun register(@Body payload: RegisterRequest): Response<AuthResponse>

    @POST("api/v1/auth/login")
    suspend fun login(@Body payload: LoginRequest): Response<AuthResponse>

    @POST("api/v1/telemetry/location")
    suspend fun sendLocationUpdate(@Body payload: LocationPayload): Response<ApiResponse>

    @POST("api/v1/telemetry/status")
    suspend fun sendStatusUpdate(@Body payload: TelemetryStatus): Response<ApiResponse>

    @POST("api/v1/driver/profile")
    suspend fun sendDriverProfile(@Body payload: DriverProfile): Response<ApiResponse>

    // Vehicles this account can act on — for a driver, their own vehicle if it was
    // already created (by a previous profile save or GPS ping), used to restore the
    // local profile after a reinstall instead of re-asking for data that already exists.
    @GET("api/v1/vehicles")
    suspend fun getVehicles(): Response<List<RemoteVehicle>>

    @POST("api/v1/documents")
    suspend fun sendDocument(@Body payload: DigitalDocument): Response<ApiResponse>

    @GET("api/v1/documents/{vehicleId}")
    suspend fun getDocuments(@Path("vehicleId") vehicleId: String): Response<List<DigitalDocument>>

    @GET("api/v1/routes/{vehicleId}")
    suspend fun getAssignedRoute(@Path("vehicleId") vehicleId: String): Response<AssignedRoute?>

    @POST("api/v1/alerts")
    suspend fun sendAlert(@Body payload: AlertPayload): Response<ApiResponse>

    @POST("api/v1/routes/{vehicleId}/simulate/start")
    suspend fun startRouteSimulation(@Path("vehicleId") vehicleId: String): Response<ApiResponse>

    @POST("api/v1/routes/{vehicleId}/simulate/stop")
    suspend fun stopRouteSimulation(@Path("vehicleId") vehicleId: String): Response<ApiResponse>

    @GET("api/v1/routes/{vehicleId}/simulate/status")
    suspend fun getRouteSimulationStatus(@Path("vehicleId") vehicleId: String): Response<SimulationStatus>

    @Multipart
    @POST("api/v1/upload/license-photo")
    suspend fun uploadLicensePhoto(@Part photo: MultipartBody.Part): Response<UploadResponse>

    companion object {
        // Production backend on Render, backed by Postgres on Neon — works from any network
        // with internet access, not just the local WiFi.
        const val BASE_URL = "https://fleetpulse-4knj.onrender.com/"

        fun create(): FleetApiService {
            val client = OkHttpClient.Builder()
                .addInterceptor { chain ->
                    val original = chain.request()
                    val token = SessionManager.token
                    val request = if (token != null) {
                        original.newBuilder().addHeader("Authorization", "Bearer $token").build()
                    } else {
                        original
                    }
                    chain.proceed(request)
                }
                .build()

            return Retrofit.Builder()
                .baseUrl(BASE_URL)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
                .create(FleetApiService::class.java)
        }
    }
}
