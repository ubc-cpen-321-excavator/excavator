package com.example.cpen321application.utils.auth

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.example.cpen321application.presentation.activities.navigateToSignin
import kotlinx.coroutines.launch
import javax.inject.Inject

abstract class AuthenticatedActivity : ComponentActivity() {

    @Inject lateinit var sessionEventBus: SessionEventBus

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                sessionEventBus.events.collect { event ->
                    when (event) {
                        SessionEvent.Expired -> navigateToSignin(this@AuthenticatedActivity)
                    }
                }
            }
        }
    }
}