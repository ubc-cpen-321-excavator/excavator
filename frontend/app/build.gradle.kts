import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.ksp)
    alias(libs.plugins.hilt)
    id("com.google.android.libraries.mapsplatform.secrets-gradle-plugin")
}

secrets {
    // To add your Maps API key to this project:
    // 1. If the secrets.properties file does not exist, create it in the root directory (the same folder as the root local.properties file).
    // 2. Add this line, where YOUR_API_KEY is your API key:
    //        MAPS_API_KEY=YOUR_API_KEY
    propertiesFileName = "secrets.properties"

    // A properties file containing default secret values. This file can be
    // checked in version control
    defaultPropertiesFileName = "local.defaults.properties"
}

// Machine-specific config (SDK path, backend URL, OAuth client ID) lives in
// local.properties, which is gitignored. See local.properties.example.
val localProperties = Properties()
val localPropertiesFile = rootProject.file("local.properties")
if (localPropertiesFile.exists()) {
    localPropertiesFile.reader().use { localProperties.load(it) }
}

fun localProperty(name: String, default: String = ""): String =
    localProperties.getProperty(name)?.trim()?.removeSurrounding("\"") ?: default

android {
    namespace = "com.example.cpen321application"
    compileSdk = libs.versions.compileSdk.get().toInt()

    defaultConfig {
        applicationId = "com.example.cpen321application"
        minSdk = libs.versions.minSdk.get().toInt()
        targetSdk = libs.versions.targetSdk.get().toInt()
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Baked in at build time from local.properties — never hard-code URLs or
        // OAuth IDs in source. Emulator reaches the host via 10.0.2.2, not localhost.
        buildConfigField(
            "String",
            "API_BASE_URL",
            "\"${localProperty("API_BASE_URL", "http://10.0.2.2:3000")}\""
        )
        buildConfigField(
            "String",
            "GOOGLE_CLIENT_ID",
            "\"${localProperty("GOOGLE_CLIENT_ID")}\""
        )
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

// Pins the JDK used to compile Kotlin and Java so the build does not depend on
// whichever JDK happens to be on the developer's PATH. Gradle downloads this
// JDK if it is missing (see the foojay resolver in settings.gradle.kts).
kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.material3)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
    androidTestImplementation(platform(libs.androidx.compose.bom))
    androidTestImplementation(libs.androidx.compose.ui.test.junit4)
    debugImplementation(libs.androidx.compose.ui.tooling)
    debugImplementation(libs.androidx.compose.ui.test.manifest)

    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.androidx.hilt.navigation.compose)

    implementation(libs.maps.compose)

    implementation(libs.googleid)

    implementation(libs.retrofit)
    implementation(libs.retrofit.gson)

}