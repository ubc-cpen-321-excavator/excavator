package com.example.cpen321application.presentation.viewmodels

import com.example.cpen321application.data.entities.Gem
import com.example.cpen321application.domain.usecases.AddGemUseCase
import com.example.cpen321application.domain.usecases.GetGemsUseCase
import com.example.cpen321application.domain.usecases.GetNewestGemsUseCase
import com.google.android.gms.maps.model.LatLng
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.single
import javax.inject.Inject

@HiltViewModel
class GemViewModel @Inject constructor(
    private val getGemsUseCase: GetGemsUseCase,
    private val getNewestGemsUseCase: GetNewestGemsUseCase,
    private val addGemUseCase: AddGemUseCase
): BaseViewModel() {

    private val _uiState = MutableStateFlow<List<Gem>>(emptyList())
    val uiState: StateFlow<List<Gem>> = _uiState.asStateFlow()

    init {
        getGems()
    }

    fun onEvent(event: GemGridEvent) {
        when (event) {
            is GemGridEvent.AddGem -> addGem(event.title, event.coords)
        }
    }

    private fun getGems() {
        launch {
            getGemsUseCase(Unit).collect { gems ->
                _uiState.value = gems
            }
        }
    }

    private fun addGem(title: String, coords: LatLng) {
        launch {

            // Store the result in a variable for now, later the result will be able to cover
            // failure cases.
            val result = addGemUseCase(
                AddGemUseCase.Params(title, coords)
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
}

sealed class GemGridEvent {
    data class AddGem(val title: String, val coords: LatLng) : GemGridEvent()
}