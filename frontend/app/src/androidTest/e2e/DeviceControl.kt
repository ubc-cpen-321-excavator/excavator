package e2e

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.ParcelFileDescriptor
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice

/** Device settings the app's own screens cannot change: permissions, the Location switch, mock locations. */
object DeviceControl {

    private val LOCATION_PERMISSIONS = listOf(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.ACCESS_COARSE_LOCATION,
    )

    val appContext: Context get() = InstrumentationRegistry.getInstrumentation().targetContext

    val uiDevice: UiDevice get() = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())

    /** Runs [command] as the shell user and returns its output once it has finished. */
    fun shell(command: String): String {
        val output = InstrumentationRegistry.getInstrumentation().uiAutomation.executeShellCommand(command)
        return ParcelFileDescriptor.AutoCloseInputStream(output).bufferedReader().use { it.readText() }
    }

    fun grantLocationPermission() {
        LOCATION_PERMISSIONS.forEach { shell("pm grant ${E2EConfig.APP_PACKAGE} $it") }
    }

    fun hasLocationPermission(): Boolean =
        LOCATION_PERMISSIONS.any { appContext.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }

    fun setLocationEnabled(enabled: Boolean) {
        shell("cmd location set-location-enabled $enabled")
    }

    fun isLocationEnabled(): Boolean = shell("cmd location is-location-enabled").trim() == "true"

    fun allowMockLocation() {
        shell("appops set ${E2EConfig.APP_PACKAGE} android:mock_location allow")
    }
}
