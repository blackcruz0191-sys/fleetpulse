package com.fleetpulse.driver.data

import android.content.Context
import com.fleetpulse.driver.model.LocationPayload
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

// Holds GPS pings that couldn't reach the server (no signal, dead zone, server
// briefly down) so they aren't silently lost — LocationTrackingService drains this
// in order once connectivity returns, instead of the driver's route having gaps.
class LocationQueueStore(context: Context) {

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val gson = Gson()
    private val listType = object : TypeToken<MutableList<LocationPayload>>() {}.type

    @Synchronized
    fun enqueue(payload: LocationPayload) {
        val current = getAll().toMutableList()
        current.add(payload)
        // Cap the queue so a driver offline for hours doesn't grow this unbounded —
        // drop the oldest points first, the most recent position matters most for
        // catching the vehicle back up once signal returns.
        while (current.size > MAX_QUEUE_SIZE) current.removeAt(0)
        save(current)
    }

    @Synchronized
    fun getAll(): List<LocationPayload> {
        val json = prefs.getString(KEY_QUEUE, null) ?: return emptyList()
        return try {
            gson.fromJson(json, listType) ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }

    @Synchronized
    fun removeFirst() {
        val current = getAll().toMutableList()
        if (current.isNotEmpty()) {
            current.removeAt(0)
            save(current)
        }
    }

    fun size(): Int = getAll().size

    private fun save(list: List<LocationPayload>) {
        prefs.edit().putString(KEY_QUEUE, gson.toJson(list)).apply()
    }

    companion object {
        private const val PREFS_NAME = "fleetpulse_location_queue"
        private const val KEY_QUEUE = "queued_locations"
        private const val MAX_QUEUE_SIZE = 300 // ~15 min of pings at the 3s update interval
    }
}
