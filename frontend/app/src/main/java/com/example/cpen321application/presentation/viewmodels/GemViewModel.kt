package com.example.cpen321application.presentation.viewmodels

import android.util.Log
import androidx.lifecycle.viewModelScope
import com.example.cpen321application.domain.models.Gem
import com.example.cpen321application.domain.usecases.AddGemUseCase
import com.example.cpen321application.domain.usecases.GetGemsUseCase
import com.example.cpen321application.domain.usecases.GetNewestGemsUseCase
import com.example.cpen321application.utils.location.Coordinates
import com.example.cpen321application.utils.location.LocationUtil
import com.example.cpen321application.utils.permissions.LocationAccess
import com.google.android.gms.maps.model.LatLng
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import javax.inject.Inject

@HiltViewModel
class GemViewModel @Inject constructor(
    private val locationUtil: LocationUtil,
    private val getGemsUseCase: GetGemsUseCase,
    private val getNewestGemsUseCase: GetNewestGemsUseCase,
    private val addGemUseCase: AddGemUseCase
): BaseViewModel() {

    private val _uiState = MutableStateFlow<List<Gem>>(emptyList())
    val uiState: StateFlow<List<Gem>> = _uiState.asStateFlow()

    private val _access = MutableStateFlow(locationUtil.currentAccess())

    init {
        getGems()
    }

    fun onEvent(event: GemEvent) {
        when (event) {
            is GemEvent.AddGem -> addGem(event.title, event.coords,event.placesName)
        }
    }

    private fun getGems() {
        launch {
            getGemsUseCase(Unit).collect { gems ->
                _uiState.value = gems
            }
        }
    }

    private fun addGem(title: String, coords: LatLng, placesName: String) {
        launch {

            // Store the result in a variable for now, later the result will be able to cover
            // failure cases.
            val result = addGemUseCase(
                AddGemUseCase.Params(title, coords, placesName)
            )

            if (result.isFailure) {
                // Cover the failure case here
            }

        }
    }

    fun getNewestGems() {
        launch {
            getNewestGemsUseCase(Unit).collect { gems ->
                _uiState.value = gems
            }
        }
    }

    override fun handleError(error: Exception) {
        throw error // Propagate the error for now
    }


    /**
     * Latest known coordinates, or null if we have none (no permission, no fix yet,
     * or the location stream failed). Approximate and precise are both plain
     * coordinates here; only their accuracy differs.
     */
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
    }


}

sealed class GemEvent {
    data class AddGem(val title: String, val coords: LatLng, val placesName: String) : GemEvent()
}