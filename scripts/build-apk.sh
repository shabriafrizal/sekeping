#!/usr/bin/env bash
#
# Build the Android APK with the web app bundled inside.
#
#   ANDROID_HOME=/path/to/android-sdk ./scripts/build-apk.sh
#
# Output: android/app/build/outputs/apk/release/app-release.apk

set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -z "${ANDROID_HOME:-}" && -n "${ANDROID_SDK_ROOT:-}" ]]; then
  export ANDROID_HOME="$ANDROID_SDK_ROOT"
fi
if [[ -z "${ANDROID_HOME:-}" ]]; then
  echo "error: set ANDROID_HOME to an Android SDK containing platform 34 and build-tools 34.0.0" >&2
  exit 1
fi
export ANDROID_SDK_ROOT="$ANDROID_HOME"

echo "==> building the web app"
npm run build

echo "==> copying dist into android/app/src/main/assets/www"
rm -rf android/app/src/main/assets/www
mkdir -p android/app/src/main/assets/www
cp -a dist/. android/app/src/main/assets/www/

echo "==> gradle assembleRelease"
cd android
./gradlew assembleRelease --console=plain "$@"

echo
echo "APK: $(pwd)/app/build/outputs/apk/release/app-release.apk"
