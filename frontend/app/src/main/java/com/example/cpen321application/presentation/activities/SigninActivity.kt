package com.example.cpen321application.presentation.activities

import android.content.Context
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.tooling.preview.Preview
import com.example.cpen321application.BuildConfig
import com.example.cpen321application.presentation.activities.ui.theme.CPEN321ApplicationTheme

import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialCustomException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.example.cpen321application.R
import com.example.cpen321application.ui.theme.CPEN321ApplicationTheme
import com.example.cpen321application.utils.AuthUtil
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import java.security.SecureRandom
import java.util.Base64
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.time.Duration.Companion.milliseconds

class SigninActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val webClientID = BuildConfig.GOOGLE_CLIENT_ID

        setContent {

            Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                ButtonUI(webClientID)
            }

        }
    }
}


@Composable
fun ButtonUI(webClientId: String) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    val onClick: () -> Unit = {
        val signInWithGoogleOption: GetSignInWithGoogleOption = GetSignInWithGoogleOption
            .Builder(serverClientId = webClientId)
            .setNonce(AuthUtil.generateSecureRandomNonce())
            .build()

        val request: GetCredentialRequest = GetCredentialRequest.Builder()
            .addCredentialOption(signInWithGoogleOption)
            .build()

        coroutineScope.launch {
            AuthUtil.signIn(request, context)
        }
    }
    Image(
        painter = painterResource(id = R.drawable.signin_pill),
        contentDescription = "",
        modifier = Modifier
            .fillMaxSize()
            .clickable(enabled = true, onClick = onClick)
    )
}


