package com.example.cpen321application.presentation.viewmodels

import android.location.Location
import android.util.Log
import androidx.lifecycle.viewModelScope
import com.example.cpen321application.data.dto.GemCandidate
import com.example.cpen321application.data.dto.GemDTO
import com.example.cpen321application.data.mappers.Mapper
import com.example.cpen321application.data.remote.websocket.DashboardLiveUpdatesClient
import com.example.cpen321application.data.remote.websocket.models.FeedEvent
import com.example.cpen321application.data.repositories.Resource
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

// TODO: Update this viewmodel to use the new Resource class

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

    private val _uiState = MutableStateFlow<UiState<Gem>>(UiState())

    private val _gemCandidates = MutableStateFlow<UiState<GemCandidate>>(UiState())

    private val _favoriteGems = MutableStateFlow<UiState<Gem>>(UiState())

    private val _newestGems = MutableStateFlow<UiState<Gem>>(UiState())

    /** True once the first HTTP load of the newest gems has landed. Live updates wait for it. */
    private val _newestLoaded = MutableStateFlow(false)

    val uiState: StateFlow<UiState<Gem>> = _uiState.asStateFlow()
    val gemCandidate: StateFlow<UiState<GemCandidate>> = _gemCandidates.asStateFlow()

    val favoriteGems: StateFlow<UiState<Gem>> = _favoriteGems.asStateFlow()
    val newestGems: StateFlow<UiState<Gem>> = _newestGems.asStateFlow()

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
     fun getGems() {
        launch {
            val firstFix = coordinates.filterNotNull().first()
            val coords = LatLng(firstFix.latitude, firstFix.longitude)

            when (val result = getNearestGemsUseCase(GetNearestGemsUseCase.Params(coords))) {
                is Resource.Error -> {
                    _uiState.value = getErrorState(result.message,_uiState.value)
                }
                else -> {
                    result.data?.collect {
                        _uiState.value = _uiState.value.copy(
                            data = it,
                            errorMessage = null
                        )
                    }
                }
            }
        }
    }

    private fun getGemCandidates() {
        launch {
            val firstFix = coordinates.filterNotNull().first()
            val coords = LatLng(firstFix.latitude,firstFix.longitude)

            when (val result = getGemCandidatesUseCase(GetGemCandidatesUseCase.Params(coords))) {
                is Resource.Error -> {
                    _gemCandidates.value = getErrorState(
                        result.message,
                        _gemCandidates.value
                        )
                }
                else -> {
                    result.data?.collect {
                        _gemCandidates.value = _gemCandidates.value.copy(
                            data = it,
                            errorMessage = null
                        )
                    }
                }
            }
        }
    }

    fun addGem(title: String, coords: LatLng) {
        launch {

            when(val result = addGemUseCase(AddGemUseCase.Params(title,coords))) {
                is Resource.Error -> {_uiState.value = getErrorState(
                    result.message,
                    _uiState.value
                )}

                else -> {
                    result.data?.collect { newGem ->
                        _uiState.value = _uiState.value.copy(
                            data = _uiState.value.data + newGem,
                            errorMessage = null
                        )
                    }
                }
            }
            }
    }

    /** Loads the newest gems over HTTP. Live updates are layered on top once this lands. */
    fun getNewestGems() {
        launch {

            when (val result = getNewestGemsUseCase(Unit)) {
                is Resource.Error -> {
                    _newestGems.value = getErrorState(
                        result.message,
                        _newestGems.value
                    )
                }

                else -> {
                    result.data?.collect { newestGems ->
                        _newestGems.value = _newestGems.value.copy(
                            data = newestGems,
                            errorMessage = null
                        )
                        _newestLoaded.value = true
                    }
                }
            }
        }
    }

    fun getFavoriteGems() {

        launch {
            when (val result = getFavoriteGemsUseCase(Unit)) {
                is Resource.Error -> {
                    _favoriteGems.value = getErrorState(
                        result.message,
                        _favoriteGems.value
                    )
                }

                else -> {
                    result.data?.collect { favoriteGems ->
                        _favoriteGems.value = _favoriteGems.value.copy(
                            data = favoriteGems,
                            errorMessage = null
                        )
                    }
                }
            }
        }
    }

    fun addFavoriteGem(gemID: String) {
        launch {
            when (val result = addFavoriteGemUseCase(
                AddFavoriteGemUseCase.Params(gemID)
            )) {
                is Resource.Error -> {
                    _favoriteGems.value = getErrorState(
                        result.message,
                        _favoriteGems.value
                    )
                }

                else -> {
                    result.data?.collect { newFavoriteGem ->
                        _favoriteGems.value = _favoriteGems.value.copy(
                            data = _favoriteGems.value.data + newFavoriteGem,
                            errorMessage = null
                        )
                    }
                }
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
                    if (current.data.any { it.sameGemAs(gem) }) current
                    else current.copy(
                        data = (listOf(gem) + current.data).take(MAX_NEWEST_GEMS)
                    )
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

