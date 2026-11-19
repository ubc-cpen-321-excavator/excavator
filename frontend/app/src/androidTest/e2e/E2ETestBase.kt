package e2e

import android.content.Context
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import com.example.cpen321application.BuildConfig
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import org.junit.After
import org.junit.Before
import org.junit.Rule

/**
 * Shared setup for every end-to-end test. The tests check the app under normal conditions: Wi-Fi on,
 * the device's location on and the app's location permission granted. Before each test it:
 *  - checks that a user is signed in (tests never sign in themselves; see Testing.md),
 *  - turns the device's location on, grants location permission and starts a mock location,
 *  - creates the API client ([api]), the test data helper ([data]) and the UI driver ([ui]).
 * Each test then opens the app itself with `ui.launchDashboard()`, once its own data is ready.
 */
abstract class E2ETestBase {

    /**
     * While this rule is active, every Compose screen in the app runs its coroutines on the rule's
     * test dispatcher. The default one (StandardTestDispatcher) queues them, and whatever is still
     * queued when the test ends is run on the test thread. The Google Maps composables then call the
     * map off the main thread, which Google Maps rejects ("Not on the main thread"). An unconfined
     * test dispatcher runs each coroutine straight away on the thread that resumes it: the main
     * thread for map callbacks, for frames and for the activity being closed.
     */
    @get:Rule
    val compose = createEmptyComposeRule(effectContext = UnconfinedTestDispatcher())

    protected lateinit var api: BackendClient
    protected lateinit var data: TestData
    protected lateinit var ui: AppDriver
    protected val mockLocation = MockLocation()

    /** Where the device pretends to be when the test starts. */
    protected abstract fun startArea(): GeoPoint

    @Before
    fun setUpBase() {
        api = BackendClient(BuildConfig.API_BASE_URL, signedInToken())
        api.checkSession()
        data = TestData(api)
        ui = AppDriver(compose)
        DeviceControl.setLocationEnabled(true)
        DeviceControl.grantLocationPermission()
        mockLocation.start(startArea())
    }

    @After
    fun tearDownBase() {
        if (::ui.isInitialized) ui.close()
        mockLocation.stop()
    }

    private fun signedInToken(): String {
        val prefs = DeviceControl.appContext.getSharedPreferences(E2EConfig.PREFS_FILE, Context.MODE_PRIVATE)
        return checkNotNull(prefs.getString(E2EConfig.PREFS_TOKEN_KEY, null)) {
            "No signed-in user: open the app, sign in, then run the tests (see Testing.md)."
        }
    }
}
