package com.example.cpen321application.utils.location

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.os.Looper
import androidx.core.content.ContextCompat
import com.example.cpen321application.utils.permissions.LocationAccess
import com.google.android.gms.location.CurrentLocationRequest
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * How often (in milliseconds) we ask for a fresh location. Tweak this to experiment.
 *
 * Fused Location treats this as a target, not a guarantee: it may deliver slower
 * if no fix is available (indoors, location off, balanced-power mode).
 */
const val LOCATION_UPDATE_INTERVAL_MS = 10_000L

/**
 * For the very first value only: a cached fix up to this old (in milliseconds) is
 * accepted as-is, which makes the first value near-instant. If nothing that recent
 * exists, a fresh fix is requested instead. Set to 0 to always require a fresh fix.
 */
const val INITIAL_FIX_MAX_AGE_MS = 30_000L

/** A plain latitude/longitude pair. Used for both precise and approximate fixes. */
data class Coordinates(
    val latitude: Double,
    val longitude: Double
)

/**
 * Hilt-provided singleton that streams the user's coordinates.
 *
 * It is stateless and cold: nothing runs until someone collects
 * [locationUpdates], and updates stop as soon as the collector goes away.
 * That makes lifecycle handling the caller's job. See LocationViewModel.
 *
 * The accuracy priority is derived from the permission that is *actually*
 * granted at collection time, so precise and approximate both work with the
 * same call.
 */
@Singleton
class LocationUtil @Inject constructor(
    @ApplicationContext private val context: Context,
    private val client: FusedLocationProviderClient
) {

    /**
     * Emits coordinates roughly every [LOCATION_UPDATE_INTERVAL_MS] while collected.
     *
     * Fails with a [SecurityException] if no location permission is granted (or it
     * is revoked mid-stream). Collectors should handle this with `.catch { }`.
     */
    @SuppressLint("MissingPermission") // Guarded by currentPriority(); null means no permission
    fun locationUpdates(): Flow<Coordinates> = callbackFlow {
        val priority = currentPriority()
            ?: throw SecurityException("Location permission has not been granted")

        val request = LocationRequest.Builder(priority, LOCATION_UPDATE_INTERVAL_MS)
            // Don't let other apps' requests make us deliver faster than our own period.
            .setMinUpdateIntervalMillis(LOCATION_UPDATE_INTERVAL_MS)
            .build()

        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { location ->
                    trySend(Coordinates(location.latitude, location.longitude))
                }
            }
        }

        // Initial value: don't make the UI wait a full interval for the first periodic fix.
        // Accepts a cached fix up to INITIAL_FIX_MAX_AGE_MS old (near-instant), otherwise
        // asks for a fresh one. Failure here is harmless: periodic updates still run.
        val initialFixToken = CancellationTokenSource()
        val initialFixRequest = CurrentLocationRequest.Builder()
            .setPriority(priority)
            .setMaxUpdateAgeMillis(INITIAL_FIX_MAX_AGE_MS)
            .build()
        client.getCurrentLocation(initialFixRequest, initialFixToken.token)
            .addOnSuccessListener { location ->
                location?.let { trySend(Coordinates(it.latitude, it.longitude)) }
            }

        client.requestLocationUpdates(request, callback, Looper.getMainLooper())
            .addOnFailureListener { close(it) }

        // Runs when the collector is cancelled: stops GPS/network work immediately.
        awaitClose {
            initialFixToken.cancel()
            client.removeLocationUpdates(callback)
        }
    }

    fun currentAccess(): LocationAccess = when {
        isGranted(Manifest.permission.ACCESS_FINE_LOCATION) -> LocationAccess.PRECISE
        isGranted(Manifest.permission.ACCESS_COARSE_LOCATION) -> LocationAccess.APPROXIMATE
        else -> LocationAccess.DENIED
    }

    private fun currentPriority(): Int? = when (currentAccess()) {
        LocationAccess.PRECISE -> Priority.PRIORITY_HIGH_ACCURACY
        LocationAccess.APPROXIMATE -> Priority.PRIORITY_BALANCED_POWER_ACCURACY
        LocationAccess.DENIED -> null
    }

    private fun isGranted(permission: String) =
        ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
}