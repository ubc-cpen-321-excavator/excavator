package com.example.cpen321application.presentation.viewmodels

data class UiState<T>(val data: T, val errorMessage: String? = null)