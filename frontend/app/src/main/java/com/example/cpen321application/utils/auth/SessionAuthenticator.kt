package com.example.cpen321application.utils.auth

import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import javax.inject.Inject

class SessionAuthenticator @Inject constructor(
    private val tokenStore: TokenStore,
    private val sessionEventBus: SessionEventBus
) : Authenticator {

    override fun authenticate(route: Route?, response: Response): Request? {
        // A 401 on a request with no token (e.g. wrong password on sign-in)
        // is not an expired session. Let the sign-in screen handle it.
        val sentToken = response.request.header("Authorization")
            ?.removePrefix("Bearer ")
            ?: return null

        // Concurrent 401s: only the first one clears the token and emits.
        synchronized(this) {
            if (tokenStore.getToken() != sentToken) return null // already handled

            tokenStore.clear()
            sessionEventBus.emit(SessionEvent.Expired)
        }

        return null
    }
}