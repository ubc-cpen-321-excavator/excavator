package com.example.cpen321application.presentation.activities.signin.composables

import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import com.example.cpen321application.R
import com.example.cpen321application.presentation.activities.NavDestination
import com.example.cpen321application.presentation.activities.navigateTo
import com.example.cpen321application.utils.auth.AuthAPIService
import com.example.cpen321application.utils.auth.AuthUtil
import com.example.cpen321application.utils.auth.GoogleSigninRequest
import com.example.cpen321application.utils.auth.SessionEventBus
import com.example.cpen321application.utils.auth.TokenStore
import kotlinx.coroutines.launch
import java.io.IOException

@Composable
fun SignInButton(
    authAPIService: AuthAPIService,
    tokenStore: TokenStore,
    sessionEventBus: SessionEventBus,
    onFinish: () -> Unit
) {

    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()

    val onClick: () -> Unit = {

        val authUtil = AuthUtil()

        coroutineScope.launch {

            authUtil.signIn(context)

            if (authUtil.idToken != null) {

                var jwtToken: String

                // TODO: The following block should be moved out into an OkHttp3 interceptor
                // For more details see section 3.3 of: https://blog.codersee.com/retrofit-with-kotlin-the-ultimate-guide/
                // Also note that the OKHttp3 Interceptor will have to be set up in the RetrofitModule singleton
                try {
                    val tokenResponse = authAPIService.googleSignin(
                        GoogleSigninRequest(authUtil.idToken!!)
                    )

                    if (tokenResponse.isSuccessful) {
                        // Can always expect a non-null body since server response is a placeholder value
                        jwtToken = tokenResponse.body()!!.sessionId

                        tokenStore.saveToken(jwtToken)
                        sessionEventBus.clearPending()

                        navigateTo(context, NavDestination.DASHBOARD)
                        onFinish()
                    }

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