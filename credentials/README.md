# credentials/ (git-ignored except this file)

| file | secret? | what |
|---|---|---|
| `EzySplit.keystore` | **YES** | Play **upload key** (alias in signing.properties). Same file as the CLI app. Lose it → Play upload-key reset via Play Console support. |
| `signing.properties` | **YES** | `MYAPP_UPLOAD_*` store/key passwords + alias, read by plugins/withEzySplitSigning.js |
| `debug.keystore` | no (shared dev key) | Same debug key as the CLI app — its SHA-1 is already in Firebase, so Google Sign-In works in debug builds |
| `EzySplit.pem` | no | Upload **certificate** (public part of the keystore), PEM/text format |
| `upload_cert.der` | no | Same certificate, DER/binary format — what Play Console's "upload key reset" form asks for |

CI uses env vars instead: ANDROID_KEYSTORE_PATH / ANDROID_KEYSTORE_PASSWORD / ANDROID_KEY_ALIAS / ANDROID_KEY_PASSWORD.
Back up the keystore + passwords somewhere safe outside this repo (password manager).
