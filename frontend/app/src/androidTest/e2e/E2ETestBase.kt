package e2e

import android.content.Context
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import com.example.cpen321application.BuildConfig
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.rules.TestName

/**
 * Shared setup for every end-to-end test. Before each test it:
 *  - checks that a user is signed in (tests never sign in themselves; see Testing.md),
 *  - turns the device's location on, grants location permission and starts a mock location,
 *  - creates the API client ([api]), the test data helper ([data]) and the UI driver ([ui]).
 * Each test then opens the app itself with `ui.launchDashboard()`, once its own data is ready.
 */
abstract class E2ETestBase {

    @get:Rule
    val compose = createEmptyComposeRule()

    @get:Rule
    val testName = TestName()

    protected lateinit var api: BackendClient
    protected lateinit var data: TestData
    protected lateinit var ui: AppDriver
    protected val mockLocation = MockLocation()

    /** Where the device pretends to be when the test starts. */
    protected abstract fun startArea(): GeoPoint

    /** Tests that must start without location permission (the run script revokes it beforehand). */
    protected open val testsStartingWithoutLocationPermission: Set<String> = emptySet()

    @Before
    fun setUpBase() {
        api = BackendClient(BuildConfig.API_BASE_URL, signedInToken())
        api.checkSession()
        data = TestData(api)
        ui = AppDriver(compose)
        DeviceControl.setLocationEnabled(true)
        if (testName.methodName !in testsStartingWithoutLocationPermission) {
            DeviceControl.grantLocationPermission()
            mockLocation.start(startArea())
        }
    }

    @After
    fun tearDownBase() {
        if (::ui.isInitialized) ui.close()
        mockLocation.stop()
        DeviceControl.grantLocationPermission()
        DeviceControl.setLocationEnabled(true)
    }

    private fun signedInToken(): String {
        val prefs = DeviceControl.appContext.getSharedPreferences(E2EConfig.PREFS_FILE, Context.MODE_PRIVATE)
        return checkNotNull(prefs.getString(E2EConfig.PREFS_TOKEN_KEY, null)) {
            "No signed-in user: open the app, sign in, then run the tests (see Testing.md)."
        }
    }
}
