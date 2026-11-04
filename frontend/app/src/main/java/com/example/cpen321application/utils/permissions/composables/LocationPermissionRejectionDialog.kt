package com.example.cpen321application.utils.permissions.composables

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.window.DialogProperties

/**
 * Blocking dialog for when the user has fully denied location access.
 * Location is required for the app's core functionality, so the only options are:
 *
 *  - Confirm: call [onRetry], which should ask for location permission again.
 *  - Dismiss: close the app (finishes every activity in the task).
 *
 * Back press and outside taps are deliberately ignored, so the user can't
 * dismiss the dialog by accident and end up with a screen that has no location
 * and no explanation. They must pick one of the two buttons.
 *
 * The caller owns visibility: only compose this while permission is denied.
 */
@Composable
fun LocationPermissionRejectionDialog(
    onRetry: () -> Unit,
    modifier: Modifier = Modifier,
    title: String = "Location is required",
    message: String =
        "This app can't work without access to your location. " +
                "Please allow location access to continue, or close the app.",
    retryLabel: String = "Try again",
    closeLabel: String = "Close app"
) {
    val activity = LocalContext.current.findActivity()

    AlertDialog(
        modifier = modifier,
        onDismissRequest = { /* Intentionally ignored: the user must choose a button. */ },
        properties = DialogProperties(
            dismissOnBackPress = false,
            dismissOnClickOutside = false
        ),
        title = { Text(title) },
        text = { Text(message) },
        confirmButton = {
            TextButton(onClick = onRetry) { Text(retryLabel) }
        },
        dismissButton = {
            // finishAffinity() closes every activity in this task, not just the current one.
            TextButton(onClick = { activity.finishAffinity() }) { Text(closeLabel) }
        }
    )
}

private tailrec fun Context.findActivity(): Activity = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> error("LocationPermissionRejectionDialog must be used within an Activity")
}