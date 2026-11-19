package com.example.cpen321application.presentation.activities.favorites

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.example.cpen321application.ui.theme.CPEN321ApplicationTheme
import dagger.hilt.android.AndroidEntryPoint


@AndroidEntryPoint
class FavoritesActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            CPEN321ApplicationTheme {
                FavoritesScreen()
            }
        }
    }
}