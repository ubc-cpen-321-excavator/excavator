package com.example.cpen321application.utils.auth


import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.receiveAsFlow
import javax.inject.Inject
import javax.inject.Singleton


sealed interface SessionEvent {
    data object Expired : SessionEvent
}

/**
 * Session event bus. Is used to emit a message to the UI layer when we get a 401 response
 * from the backend. The reaction to getting a message from here should be to redirect to Signin
 */
@Singleton
class SessionEventBus @Inject constructor() {
    private val channel = Channel<SessionEvent>(Channel.BUFFERED)
    val events: Flow<SessionEvent> = channel.receiveAsFlow()

    fun emit(event: SessionEvent) {
        channel.trySend(event)
    }

    fun clearPending(){
        while(channel.tryReceive().isSuccess){}
    }
}