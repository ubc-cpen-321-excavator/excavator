package com.example.cpen321application.presentation.activities.signin

import android.os.Bundle

import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.fillMaxSize

import androidx.compose.material3.Scaffold

import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource

import com.example.cpen321application.R

import com.example.cpen321application.utils.AuthAPIService
import com.example.cpen321application.utils.AuthUtil
import com.example.cpen321application.utils.GoogleSigninRequest

import dagger.hilt.android.AndroidEntryPoint

import kotlinx.coroutines.launch
import java.io.IOException

import javax.inject.Inject


@AndroidEntryPoint
class SigninActivity : ComponentActivity() {

    @Inject lateinit var authAPIService: AuthAPIService

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {

            Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
                ButtonUI(authAPIService)
            }

        }
    }
}

@Composable
fun ButtonUI(authAPIService: AuthAPIService) {

    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    val onClick: () -> Unit = {

        val authUtil = AuthUtil()

        coroutineScope.launch {

            authUtil.signIn(context)

            if (authUtil.idToken != null) {

                var displayMessage: String

                // TODO: The following block should be moved out into an OkHttp3 interceptor
                // For more details see section 3.3 of: https://blog.codersee.com/retrofit-with-kotlin-the-ultimate-guide/
                // Also note that the OKHttp3 Interceptor will have to be set up in the RetrofitModule singleton
                try {
                    val tokenResponse = authAPIService.googleSignin(
                        GoogleSigninRequest(authUtil.idToken!!)
                    )

                    displayMessage = if (tokenResponse.isSuccessful) {
                        // Can always expect a non-null body since server response is a placeholder value
                        tokenResponse.body()!!.sessionId
                    } else {
                        "Error: Code ${tokenResponse.code()}"
                    }

                    Toast.makeText(context, displayMessage, Toast.LENGTH_LONG).show()

                }  catch (e: IOException) {
                    Toast.makeText(context,
                        "Failed to connect to server. Please try again later",
                        Toast.LENGTH_SHORT)
                        .show()
                }

            } // Signin error conditions are handled in AuthUtil
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


