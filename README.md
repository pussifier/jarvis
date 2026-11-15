# JARVIS for Windows

A standalone Windows desktop application with a native app window, microphone input, speech, local memory and approved computer actions. The existing hosted JARVIS site is a separate application and is not modified by this project.

## Install and start

1. Use 64-bit Windows 10 or Windows 11. Run `JARVIS-1.0.0-Windows-Setup.exe` to install for your user account. It installs to `%LOCALAPPDATA%\Programs\JARVIS`, adds Start menu shortcuts and offers a desktop shortcut. Alternatively extract the complete Windows ZIP and run `JARVIS.exe` inside it; do not move the EXE away from its accompanying files.
2. Open JARVIS. Settings opens on the first launch. Select Groq and keep `openai/gpt-oss-120b`, or select OpenAI API and enter a model available to your API account. Paste the matching provider key. A ChatGPT subscription is not an API key.
3. For microphone transcription, enter a Groq key. For the requested JARVIS voice, enter a Fish Audio key, model `s2.1-pro-free`, and reference ID `612b878b113047d9a770c069c8b4fdfe`. No keys are shipped in the app or source. Keys previously entered into the hosted site are not automatically transferred to your PC.
4. Save settings. **Check key & load models** tests the saved AI connection. **Test saved voice** generates and plays a short spoken sample.
5. Choose a workspace folder in Settings. The initial workspace is `Documents\JARVIS Workspace`. File tools only access the selected folder and do not follow links outside it.
6. Hold **Hold to talk**, speak, and release to transcribe and send. `Ctrl+Shift+Space` toggles recording from other applications, or interrupts a running turn/voice. **Stop** discards an active recording and cancels chat, commands and audio. The mic is not continuously listening. If Windows denies access, enable microphone access for desktop apps in Windows Settings → Privacy & security → Microphone.

This build is unsigned; Windows may show an unknown-publisher warning or your organization may block it. Review the included source and use your organization's normal software approval process. Do not disable security controls. No administrator privileges are requested.

## What is implemented

- Groq/OpenAI tool-capable chat, with actual provider errors and model selection.
- Groq Whisper transcription of microphone recordings, up to two minutes / 16 MB per recording.
- Fish Audio voice with the configured reference ID; long answers are split into complete chunks, not silently cut off. Code blocks and raw links are described as available in chat instead of read verbatim. Voice speed is adjustable. The ring responds to actual playback amplitude.
- Local conversation archive, export to Markdown and confirmation before clearing the archive.
- Editable/importable Markdown memory, a verified note index, and append-only daily activity checkpoints. Profile loads each turn; other notes are retrieved through tools. The AI receives the latest 30 conversation messages, not an unlimited transcript. The complete local conversation remains in the archive until cleared.
- Tools to list files, search file names, read complete text files, create/replace text files, launch supported apps, open HTTP(S) links and execute explicitly approved PowerShell commands.
- Native approval dialogs show the exact path, complete before/after file content or exact command before acting. Denial is not execution. No approval-bypass mode is provided.
- Supported app names: Notepad, Calculator, Explorer, Paint, Windows Terminal, Edge, Chrome and VS Code. The requested application must be installed. A launch request is not proof that a window is visible.
- File read limit: 60,000 bytes, with an explicit error for larger files. Search scans up to 5,000 entries / 200 matches, excludes symbolic links, node_modules and .git, and reports limits. PowerShell commands have a 60-second timeout and a 60,000-character output cap, explicitly marked if output is limited.

## Try it

- “Open Calculator.” Review and allow the launch request.
- “List the files in my workspace.” Approve the directory access.
- “Create hello.txt in my workspace containing Hello from JARVIS.” Review the file contents before allowing.
- “Remember that I prefer concise answers. Save this in my Profile.” Check Memory to verify the saved note.
- “What time is it on this computer?” Uses system time rather than guessing.

## Boundaries

This app cannot obey every possible request. It has no general screen vision, automatic mouse/keyboard control, webcam gestures, web browsing/search content retrieval, email/calendar integration, unattended scheduling or execution while closed. It cannot bypass Windows permissions. Approved PowerShell commands run under your Windows account and can affect files outside the selected workspace; the complete command is shown for review. Interrupting a command cannot undo changes it has already made.

It runs as a native desktop app using Electron; an embedded Chromium renderer draws the interface. You do not need to keep a browser tab open or run a local server. Cloud chat, transcription and voice require internet and provider access. Memory editing works offline; chat does not have an offline model.

## Data and credentials

Data lives under `%APPDATA%\JARVIS` (Electron userData). `settings.json` contains nonsecret preferences. `credentials.enc.json` contains ciphertext encrypted using Electron safeStorage / Windows DPAPI, tied to your Windows account. Plaintext keys are not returned to the renderer, included in generated notes, or embedded in installers. Re-enter keys after changing Windows accounts or if decryption fails. Keys can be replaced by pasting a new value in Settings; blank fields preserve existing keys.

`Vault\Notes` holds Markdown notes; `Vault\INDEX.md` lists them; `Vault\Daily` holds dated checkpoints; `Vault\Rules.md` records working rules. Settings can select a different vault folder, including an Obsidian folder, without moving existing files. A JARVIS index and Notes/Daily folders will be created there. Back up the vault and conversation.json as needed. Notes, conversation and command output are local plaintext. Do not store secrets in them. Deleting the app does not intentionally delete your data.

Messages and relevant tool results are sent to the selected AI service. Recorded speech is sent to Groq for transcription. Spoken response text is sent to Fish Audio. The app does not send entire folders automatically, uses no telemetry, and keeps API keys in the main process. Recognizable API-key strings are rejected from chat/memory or redacted from tool output; this is not a universal secret detector. Review documents before sharing them with cloud AI.

## Build from source

Use Node.js 22.12+ (Node 24 recommended) and npm on Windows. The pinned package-lock.json is included.

```powershell
npm ci
npm test
npm run check
npm run dist:win
```

The release directory contains the NSIS installer and standalone ZIP. The bundled NSIS compiler builds the installer directly; Wine is not required. Run `npm start` for development after `npx install-electron` if the Electron runtime is not yet downloaded. `npm run test:ui` uses an installed Chromium via CHROMIUM_PATH or `/usr/bin/chromium` for the renderer checks. It mocks desktop IPC and does not substitute for Windows hardware tests.

The build requests x64 packages, includes local assets only, uses context isolation and a sandboxed renderer, disables Node.js in the renderer and blocks navigation/new windows. No server port is opened. Runtime actions are implemented in the main process behind a fixed IPC allowlist.

See VALIDATION.md for the checks actually performed and their limits. See THIRD-PARTY.md for dependencies and references.

A manual GitHub Actions workflow is included at `.github/workflows/windows-build.yml` to rebuild on a real Windows runner after the source is published. It has not been run in this workspace. It uploads build artifacts and does not automatically publish releases.
