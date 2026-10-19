package com.example.cpen321application.viewmodels

import com.example.cpen321application.data.entities.Gem
import com.example.cpen321application.domain.usecases.GetGemsUseCase
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

@HiltViewModel
class GemViewModel @Inject constructor(
    private val getGemsUseCase: GetGemsUseCase
): BaseViewModel() {

    private val _uiState = MutableStateFlow<List<Gem>>(emptyList())
    val uiState: StateFlow<List<Gem>> = _uiState.asStateFlow()

    init {
        getGems()
    }

    private fun getGems() {
        launch {
            getGemsUseCase(Unit).collect { gems ->
                _uiState.value = gems
            }
        }
    }

    override fun handleError(error: Exception) {
        throw error // Propagate the error for now
    }
}