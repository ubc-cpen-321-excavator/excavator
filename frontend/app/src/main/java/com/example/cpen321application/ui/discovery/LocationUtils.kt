package com.example.cpen321application.ui.discovery

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.tasks.CancellationTokenSource
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

private const val TAG = "DiscoveryLocation"

/** Location permissions the discovery screen asks for. The user may grant either precise or approximate. */
internal val locationPermissions = arrayOf(
    Manifest.permission.ACCESS_FINE_LOCATION,
    Manifest.permission.ACCESS_COARSE_LOCATION,
)

/** True if the user has granted precise or approximate location access. */
internal fun Context.hasLocationPermission(): Boolean = locationPermissions.any { permission ->
    ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
}

/**
 * Asks Google Play services' fused location provider for the device's current position.
 *
 * Returns `null` if location permission is missing, location services are off, or no fix is available (for example
 * an emulator with no location set), so callers should keep a sensible default view in that case.
 *
 * Lint's MissingPermission check is suppressed because lint can't see the permission check inside
 * [hasLocationPermission] on the first line.
 */
@SuppressLint("MissingPermission")
internal suspend fun Context.getCurrentLatLng(): LatLng? {
    if (!hasLocationPermission()) return null

    val locationClient = LocationServices.getFusedLocationProviderClient(this)
    val cancellationTokenSource = CancellationTokenSource()

    return suspendCancellableCoroutine { continuation ->
        // If the screen goes away while we're waiting, cancel the location request too.
        continuation.invokeOnCancellation { cancellationTokenSource.cancel() }
        try {
            // Balanced accuracy (~100 m) is plenty to center the camera and saves battery. The blue
            // "you are here" dot is tracked separately, and more precisely, by the Maps SDK itself.
            locationClient
                .getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, cancellationTokenSource.token)
                .addOnSuccessListener { location ->
                    continuation.resume(location?.let { LatLng(it.latitude, it.longitude) })
                }
                .addOnFailureListener { error ->
                    Log.w(TAG, "Could not get the current location", error)
                    continuation.resume(null)
                }
        } catch (error: SecurityException) {
            // The user revoked the permission between the check above and this call.
            Log.w(TAG, "Location permission was revoked", error)
            continuation.resume(null)
        }
    }
}
