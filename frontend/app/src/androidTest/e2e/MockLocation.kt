package e2e

import android.location.Location
import android.os.SystemClock
import com.google.android.gms.location.LocationServices
import com.google.android.gms.tasks.Task
import com.google.android.gms.tasks.Tasks
import java.util.Timer
import java.util.concurrent.TimeUnit
import kotlin.concurrent.fixedRateTimer

/**
 * Makes the device report a chosen location through the fused location provider's mock mode, which
 * is what the app reads. The point is re-sent every second so the app's periodic requests keep
 * getting it. Works on emulators and phones; [start] grants the mock-location app-op it needs.
 */
class MockLocation {

    private val client = LocationServices.getFusedLocationProviderClient(DeviceControl.appContext)
    private var timer: Timer? = null

    @Volatile
    private var point: GeoPoint? = null

    fun start(at: GeoPoint) {
        DeviceControl.allowMockLocation()
        await(client.setMockMode(true))
        moveTo(at)
        timer = fixedRateTimer(name = "e2e-mock-location", daemon = true, period = PERIOD_MS) {
            point?.let { push(it) }
        }
    }

    fun moveTo(at: GeoPoint) {
        point = at
        push(at)
    }

    fun stop() {
        timer?.cancel()
        timer = null
        if (point != null) {
            point = null
            runCatching { await(client.setMockMode(false)) }
        }
    }

    private fun push(at: GeoPoint) {
        val location = Location(PROVIDER).apply {
            latitude = at.latitude
            longitude = at.longitude
            accuracy = ACCURACY_M
            time = System.currentTimeMillis()
            elapsedRealtimeNanos = SystemClock.elapsedRealtimeNanos()
        }
        client.setMockLocation(location)
    }

    private fun <T> await(task: Task<T>): T = Tasks.await(task, TASK_TIMEOUT_S, TimeUnit.SECONDS)

    private companion object {
        const val PROVIDER = "fused"
        const val ACCURACY_M = 5f
        const val PERIOD_MS = 1_000L
        const val TASK_TIMEOUT_S = 10L
    }
}
