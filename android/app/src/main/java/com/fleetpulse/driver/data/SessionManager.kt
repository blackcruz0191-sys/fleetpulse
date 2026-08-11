package com.fleetpulse.driver.data

import android.content.Context

/**
 * Holds the current session token in memory so the Retrofit auth interceptor can read it
 * without needing a Context on every request, while SharedPreferences keeps it across restarts.
 */
object SessionManager {
    private const val PREFS_NAME = "fleetpulse_session_prefs"
    private const val KEY_TOKEN = "auth_token"
    private const val KEY_USERNAME = "auth_username"
    private const val KEY_COMPANY = "auth_company"
    private const val KEY_ROLE = "auth_role"
    private const val KEY_DRIVER_CODE = "auth_driver_code"

    @Volatile
    var token: String? = null
        private set

    var username: String? = null
        private set

    var companyName: String? = null
        private set

    var role: String? = null
        private set

    var driverCode: String? = null
        private set

    fun init(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        token = prefs.getString(KEY_TOKEN, null)
        username = prefs.getString(KEY_USERNAME, null)
        companyName = prefs.getString(KEY_COMPANY, null)
        role = prefs.getString(KEY_ROLE, null)
        driverCode = prefs.getString(KEY_DRIVER_CODE, null)
    }

    fun save(context: Context, token: String, username: String, companyName: String?, role: String? = null, driverCode: String? = null) {
        this.token = token
        this.username = username
        this.companyName = companyName
        this.role = role
        this.driverCode = driverCode

        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_USERNAME, username)
            .putString(KEY_COMPANY, companyName)
            .putString(KEY_ROLE, role)
            .putString(KEY_DRIVER_CODE, driverCode)
            .apply()
    }

    fun clear(context: Context) {
        token = null
        username = null
        companyName = null
        role = null
        driverCode = null
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().clear().apply()
    }

    fun isAuthenticated(): Boolean = token != null
}
