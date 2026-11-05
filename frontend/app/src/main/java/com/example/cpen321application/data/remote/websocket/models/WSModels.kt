package com.example.cpen321application.data.remote.websocket.models

import com.example.cpen321application.data.dto.GemDTO

sealed interface SocketState {
    data object Disconnected : SocketState
    data object Connecting : SocketState
    data object Connected : SocketState
    data class Failed(val error: Throwable, val httpCode: Int? = null) : SocketState
}

/** Events the server can send. */
sealed interface FeedEvent {
    data class Subscribed(val latitude: Double, val longitude: Double, val radius: Int) : FeedEvent
    data class GemAdded(val gem: GemDTO) : FeedEvent
    data class Error(val message: String) : FeedEvent
}

/** The latest requested subscription, remembered so it can be re-sent after a reconnect. */
data class FeedSubscription(val latitude: Double, val longitude: Double, val radius: Int?)
