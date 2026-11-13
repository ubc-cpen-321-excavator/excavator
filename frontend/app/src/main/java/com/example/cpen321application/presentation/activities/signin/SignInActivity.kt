package com.example.cpen321application.presentation.activities.signin

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Scaffold
import androidx.compose.ui.Modifier
import com.example.cpen321application.presentation.activities.NavDestination
import com.example.cpen321application.presentation.activities.navigateTo
import com.example.cpen321application.presentation.activities.signin.composables.SignInButton
import com.example.cpen321application.utils.auth.AuthAPIService
import com.example.cpen321application.utils.auth.SessionEventBus
import com.example.cpen321application.utils.auth.TokenStore
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject


@AndroidEntryPoint
class SignInActivity : ComponentActivity() {

    @Inject lateinit var authAPIService: AuthAPIService
    @Inject lateinit var tokenStore: TokenStore
    @Inject lateinit var sessionEventBus: SessionEventBus

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        if (tokenStore.getToken() != null) {
            navigateTo(this@SignInActivity, NavDestination.DASHBOARD)
        }

        setContent {

            Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                SignInButton(authAPIService, tokenStore, sessionEventBus) {
                    finish()
                }
            }

        }
    }
}




