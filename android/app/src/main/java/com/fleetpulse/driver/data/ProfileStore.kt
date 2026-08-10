package com.fleetpulse.driver.data

import android.content.Context
import com.fleetpulse.driver.model.DriverProfile
import com.google.gson.Gson

class ProfileStore(context: Context) {

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val gson = Gson()

    fun load(): DriverProfile? {
        val json = prefs.getString(KEY_PROFILE, null) ?: return null
        return try {
            gson.fromJson(json, DriverProfile::class.java)
        } catch (e: Exception) {
            null
        }
    }

    fun save(profile: DriverProfile) {
        prefs.edit().putString(KEY_PROFILE, gson.toJson(profile)).apply()
    }

    fun clear() {
        prefs.edit().remove(KEY_PROFILE).apply()
    }

    companion object {
        private const val PREFS_NAME = "fleetpulse_driver_prefs"
        private const val KEY_PROFILE = "driver_profile"
    }
}
