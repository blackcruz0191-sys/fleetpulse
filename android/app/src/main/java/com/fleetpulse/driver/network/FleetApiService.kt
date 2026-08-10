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

    @POST("api/v1/documents")
    suspend fun sendDocument(@Body payload: DigitalDocument): Response<ApiResponse>

    @GET("api/v1/documents/{vehicleId}")
    suspend fun getDocuments(@Path("vehicleId") vehicleId: String): Response<List<DigitalDocument>>

    @GET("api/v1/routes/{vehicleId}")
    suspend fun getAssignedRoute(@Path("vehicleId") vehicleId: String): Response<AssignedRoute?>

    @POST("api/v1/alerts")
    suspend fun sendAlert(@Body payload: AlertPayload): Response<ApiResponse>

    @Multipart
    @POST("api/v1/upload/license-photo")
    suspend fun uploadLicensePhoto(@Part photo: MultipartBody.Part): Response<UploadResponse>

    companion object {
        // Local dev backend on the host machine's LAN IP (Wi-Fi adapter), so a physical phone
        // on the same network can reach it. Update this if the PC's IP changes (e.g. new
        // network, DHCP renewal) — check with `ipconfig` / `Get-NetIPAddress` on the PC.
        const val BASE_URL = "http://192.168.50.59:3000/"

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
