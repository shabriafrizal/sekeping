# Demo signing key

`sekeping-release.jks` is a **demo** signing key committed so that anyone can build a
release APK that upgrades an installed copy (Android requires the same key for updates).

- Store password: `sekeping`
- Key alias: `sekeping`
- Key password: `sekeping`

Do not use this key for a Play Store release. Generate your own and replace the file,
or remove it — the Gradle build falls back to the debug key when the file is missing.
