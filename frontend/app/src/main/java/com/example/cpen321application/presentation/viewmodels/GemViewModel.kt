package com.example.cpen321application.presentation.viewmodels

import android.location.Location
import android.util.Log
import androidx.lifecycle.viewModelScope
import com.example.cpen321application.data.dto.GemCandidate
import com.example.cpen321application.data.dto.GemDTO
import com.example.cpen321application.data.mappers.Mapper
import com.example.cpen321application.data.remote.websocket.DashboardLiveUpdatesClient
import com.example.cpen321application.data.remote.websocket.models.FeedEvent
import com.example.cpen321application.di.InjectGemMapper
import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.domain.usecases.gem.AddGemUseCase
import com.example.cpen321application.domain.usecases.gem.GetGemCandidatesUseCase
import com.example.cpen321application.domain.usecases.gem.GetNearestGemsUseCase
import com.example.cpen321application.domain.usecases.gem.GetNewestGemsUseCase
import com.example.cpen321application.domain.usecases.gem.favorites.AddFavoriteGemUseCase
import com.example.cpen321application.domain.usecases.gem.favorites.DeleteFavoriteGemUseCase
import com.example.cpen321application.domain.usecases.gem.favorites.GetFavoriteGemsUseCase
import com.example.cpen321application.utils.location.Coordinates
import com.example.cpen321application.utils.location.LocationUtil
import com.example.cpen321application.utils.permissions.LocationAccess
import com.google.android.gms.maps.model.LatLng
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.conflate
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.mapLatest
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class GemViewModel @Inject constructor(
    private val locationUtil: LocationUtil,

    private val getNearestGemsUseCase: GetNearestGemsUseCase,
    private val getNewestGemsUseCase: GetNewestGemsUseCase,
    private val addGemUseCase: AddGemUseCase,
    private val getGemCandidatesUseCase: GetGemCandidatesUseCase,

    private val getFavoriteGemsUseCase: GetFavoriteGemsUseCase,
    private val addFavoriteGemUseCase: AddFavoriteGemUseCase,
    private val deleteFavoriteGemUseCase: DeleteFavoriteGemUseCase,

    private val liveUpdatesClient: DashboardLiveUpdatesClient,
    @param:InjectGemMapper private val mapper: Mapper<Gem, GemDTO>
) : BaseViewModel() {

    private val _uiState = MutableStateFlow<List<Gem>>(emptyList())

    private val _gemCandidates = MutableStateFlow<List<GemCandidate>>(emptyList())

    private val _favoriteGems = MutableStateFlow<List<Gem>>(emptyList())

    private val _newestGems = MutableStateFlow<List<Gem>>(emptyList())

    /** True once the first HTTP load of the newest gems has landed. Live updates wait for it. */
    private val _newestLoaded = MutableStateFlow(false)

    val uiState: StateFlow<List<Gem>> = _uiState.asStateFlow()
    val gemCandidate: StateFlow<List<GemCandidate>> = _gemCandidates.asStateFlow()

    val favoriteGems: StateFlow<List<Gem>> = _favoriteGems.asStateFlow()
    val newestGems: StateFlow<List<Gem>> = _newestGems.asStateFlow()

    private val _access = MutableStateFlow(locationUtil.currentAccess())

    @OptIn(ExperimentalCoroutinesApi::class)
    val coordinates: StateFlow<Coordinates?> = _access
        // Restarts the stream when access changes, e.g. APPROXIMATE -> PRECISE after
        // the user accepts the upgrade prompt, so the better priority takes effect.
        .flatMapLatest { trackingFlow(it) }
        .stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(STOP_TIMEOUT_MS),
            initialValue = null
        )

    init {
        getGems()
        getNewestGems()
        observeLiveUpdates()
    }

    // TODO: Make this play a bigger role in the gem viewmodel
    fun onEvent(event: GemEvent) {
        when (event) {
            is GemEvent.AddGem -> addGem(event.title, event.coords)
        }
    }

    /**
     * Loads the gems nearest to the user, using their first real fix.
     *
     * Reading `coordinates.value` here would not work: at init it is always null (the
     * stream only runs while something collects it), so the lookup would be silently
     * skipped. Instead we suspend until the first non-null fix arrives.
     *
     * Collecting here also keeps the location stream alive until that fix, which is
     * what lets this work even if the permission result arrives after the ViewModel
     * is created. `first()` then cancels the collection, so the stream can shut down
     * when no UI is watching.
     */
    private fun getGems() {
        launch {
            val firstFix = coordinates.filterNotNull().first()

            getNearestGemsUseCase(
                GetNearestGemsUseCase.Params(LatLng(firstFix.latitude, firstFix.longitude))
            ).collect { gems ->
                _uiState.value = gems
            }
        }
    }

    private fun getGemCandidates() {
        launch {
            val firstFix = coordinates.filterNotNull().first()

            getGemCandidatesUseCase(
                GetGemCandidatesUseCase.Params(LatLng(firstFix.latitude, firstFix.longitude))
            ).collect { gemCandidates ->
                _gemCandidates.value = gemCandidates
            }
        }
    }

    fun addGem(title: String, coords: LatLng) {
        launch {
            addGemUseCase(AddGemUseCase.Params(title, coords)).collect { newGem ->
                _uiState.value += newGem
            }
        }
    }

    /** Loads the newest gems over HTTP. Live updates are layered on top once this lands. */
    fun getNewestGems() {
        launch {
            getNewestGemsUseCase(Unit).collect { gems ->
                _newestGems.value = gems
                _newestLoaded.value = true
            }
        }
    }

    fun getFavoriteGems() {
        launch {
            getFavoriteGemsUseCase(Unit).collect { favorites ->
                _favoriteGems.value = favorites
            }
        }
    }

    fun addFavoriteGem(gemID: String) {
        launch {
            addFavoriteGemUseCase(
                AddFavoriteGemUseCase.Params(gemID)
            ).collect { newFavorite ->
                _favoriteGems.value += newFavorite
            }
        }
    }

    fun deleteFavoriteGem(placesID: String) {
        launch {
            deleteFavoriteGemUseCase(
                DeleteFavoriteGemUseCase.Params(placesID)
            )
        }
    }

    // ---------------------------------------------------------------------------------
    // Live updates
    // ---------------------------------------------------------------------------------

    /**
     * Runs the live feed only while a composable observes [newestGems]. The grace period
     * keeps the socket open across brief gaps such as a configuration change.
     */
    @OptIn(ExperimentalCoroutinesApi::class)
    private fun observeLiveUpdates() {
        viewModelScope.launch {
            _newestGems.subscriptionCount
                .map { it > 0 }
                // Delay only the "no observers" transition; a quick re-subscribe cancels it.
                .mapLatest { active -> if (!active) delay(STOP_TIMEOUT_MS); active }
                .distinctUntilChanged()
                .collectLatest { active -> if (active) runLiveUpdates() }
        }
    }

    /** Suspends while the feed is live; cancelling it (no observers) closes the socket. */
    private suspend fun runLiveUpdates() {
        _newestLoaded.first { it } // HTTP snapshot first, then live updates on top

        liveUpdatesClient.connect()
        try {
            coroutineScope {
                // Keep the server's subscription centred on the user.
                launch {
                    coordinates
                        .filterNotNull()
                        .distinctUntilChanged { old, new -> distanceM(old, new) < MIN_MOVE_M }
                        .conflate()
                        .collect { c ->
                            liveUpdatesClient.subscribe(c.latitude, c.longitude, LIVE_RADIUS_M)
                            delay(SUBSCRIBE_GAP_MS) // server allows 1 subscribe/second
                        }
                }
                // Fold incoming gems into the list.
                launch {
                    liveUpdatesClient.events.collect { onFeedEvent(it) }
                }
            }
        } finally {
            liveUpdatesClient.disconnect()
        }
    }

    private fun onFeedEvent(event: FeedEvent) {
        when (event) {
            is FeedEvent.GemAdded -> {
                val gem = runCatching { mapper.toDomain(event.gem) }
                    .onFailure { Log.w(TAG, "Bad gem in live update", it) }
                    .getOrNull() ?: return

                _newestGems.update { current ->
                    if (current.any { it.sameGemAs(gem) }) current
                    else (listOf(gem) + current).take(MAX_NEWEST_GEMS)
                }
            }
            is FeedEvent.Error -> Log.w(TAG, "Live feed error: ${event.message}")
            is FeedEvent.Subscribed -> Unit
        }
    }

    /** placesName is the gem's primary key. */
    private fun Gem.sameGemAs(other: Gem): Boolean = placesName == other.placesName

    private fun distanceM(a: Coordinates, b: Coordinates): Float {
        val out = FloatArray(1)
        Location.distanceBetween(a.latitude, a.longitude, b.latitude, b.longitude, out)
        return out[0]
    }

    // ---------------------------------------------------------------------------------
    // Errors and location
    // ---------------------------------------------------------------------------------

    override fun handleError(error: Exception) {
        throw error // Propagate the error for now
    }

    /** Call this from the permission callback. Safe to call repeatedly. */
    fun onLocationAccess(newAccess: LocationAccess) {
        _access.value = newAccess
    }

    private fun trackingFlow(access: LocationAccess): Flow<Coordinates?> =
        if (access == LocationAccess.DENIED) {
            flowOf(null)
        } else {
            locationUtil.locationUpdates()
                .map<Coordinates, Coordinates?> { it }
                .catch { error ->
                    // E.g. permission revoked mid-stream. Surface "no location" instead of crashing.
                    Log.w(TAG, "Location updates failed", error)
                    emit(null)
                }
        }

    private companion object {
        const val TAG = "GemViewModel"
        const val STOP_TIMEOUT_MS = 5_000L
        const val LIVE_RADIUS_M = 5_000      // matches the server default
        const val MIN_MOVE_M = 100f          // re-subscribe only after moving this far
        const val SUBSCRIBE_GAP_MS = 1_000L  // server's minimum gap between subscribes
        const val MAX_NEWEST_GEMS = 50
    }
}

sealed class GemEvent {
    data class AddGem(val title: String, val coords: LatLng, val placesName: String) : GemEvent()
}