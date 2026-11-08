plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "dev.shabri.sekeping"
    compileSdk = 34

    defaultConfig {
        applicationId = "dev.shabri.sekeping"
        minSdk = 24
        targetSdk = 34
        versionCode = 11
        versionName = "1.1.9"
        resourceConfigurations += listOf("en", "id")
    }

    signingConfigs {
        val keystore = file("keystore/sekeping-release.jks")
        if (keystore.exists()) {
            create("release") {
                storeFile = keystore
                storePassword = "sekeping"
                keyAlias = "sekeping"
                keyPassword = "sekeping"
            }
        }
    }

    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            isShrinkResources = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("release") ?: signingConfigs.getByName("debug")
        }
        getByName("debug") {
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    androidResources {
        // The bundled web build is copied here by scripts/build-apk.sh
        noCompress += listOf("woff2")
    }

    packaging {
        resources.excludes += setOf("META-INF/*.kotlin_module", "META-INF/LICENSE*")
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.11.0")
}
