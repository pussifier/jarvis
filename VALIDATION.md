# Validation

## Passed in the Linux build workspace

- 22 automated core/main-process tests: path traversal and symlink blocking, Windows-safe note names, URL restrictions, oversized/binary full-read rejection, verified memory saves/index/checkpoints, secret rejection, denied action side effects, exact before/after write previews, stale-file protection, cancellation, command encoding, credential ciphertext/public settings separation, encryption-backend refusal, provider errors, tool loops, persistence-error recovery, and main-process IPC sender checks.
- Renderer checks in installed Chromium, using mocked desktop IPC: conversation, activity log, memory editing, model list, clearing key inputs, generated-microphone recording/transcription/send flow, and 1360×900 / 960×700 layouts. No renderer page errors were recorded. Screenshots use fixture messages and are not evidence of executing Windows actions.
- Syntax checks on every runtime JS/CJS file, required local assets, restrictive renderer CSP, and checks for embedded API-key patterns in runtime source.
- Live Groq GPT-OSS 120B conversation with a real system_info tool call.
- Live Fish Audio synthesis with s2.1-pro-free and the requested reference voice.
- Live Groq Whisper transcription of the generated audio. The transcript included the spoken greeting.

## Packaging verified

- Windows x64 Electron ZIP generated; ZIP integrity check passed.
- All packaged runtime source files match the final runtime source on disk.
- Per-user Windows NSIS installer compiled successfully without Wine, with no compiler warnings in the final build.
- Installer and application have Windows PE headers; release SHA-256 checksums are recorded separately.
- Runtime source checks and packaged file listing found no embedded credential data.

## Windows checks still required on the user's PC

This environment runs Linux. A Windows installer can be cross-compiled here, but the following have not been verified on real Windows: installation/uninstallation, app startup, DPAPI encryption/decryption, Windows microphone devices/privacy settings, global hotkey registration, standard application launches, native approval-dialog layout, and real PowerShell execution/interruption. Tests use mocks for Windows-specific execution. No Windows compatibility claim beyond the targeted Windows 10/11 x64 build should be inferred from Linux unit or browser tests.

The installer and executable are unsigned. Cloud providers require valid keys, internet, account access and any applicable credits. Keys are deliberately excluded from release files and must be entered once in desktop Settings.
