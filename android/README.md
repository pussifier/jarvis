# JARVIS for Galaxy S24 Ultra

A native Android assistant, with a launcher icon, local Markdown memory, saved conversations, action review, voice recording/transcription, Android spoken replies, a native visualizer, and a touch/S Pen-friendly notes board. No desktop Python server, browser installation or WebView is required.

## Download

- [Download the signed Android APK](./JARVIS-S24-Ultra.apk?raw=true)
- [Download complete Android source](./JARVIS-Android-Source.zip?raw=true)

Open the APK on your phone and follow Android/Samsung’s installation prompts. Open JARVIS → Settings, enter your own OpenAI API key on the phone, and save it. Then send a short chat message to verify API/model access. Do not put a key in a GitHub issue, chat, source file or note. The app ships without an API credential. Local notes/reference browsing work offline; AI replies and transcription require internet and API access.

The personal credential is encrypted using Android Keystore. It is decrypted inside the app process to authenticate direct HTTPS calls. All spoken replies are AI-generated; output uses your installed Android text-to-speech engine. Hold Talk to record, release to transcribe, review the transcript, then Send. Memory and rules stay in app-private Markdown storage; use Export vault for an Obsidian-compatible copy. Export notes before uninstalling if you want to keep them.

## Verified build

- Native package: `com.jarvis.assistant`, version `1.0.0`; minimum API 26, target API 35.
- 25 native core tests passed using temporary storage and a local mock API service.
- Native Java/resource/DEX build completed. APK v2/v3 signatures and alignment verified.
- Package/source inspection passed: actual native launcher activity, no WebView/browser/Python runtime, complete source and license texts, all twelve supplied operating rules, no runtime conversation data or signing keys in exports.
- No physical S24 Ultra, rendered Android UI, microphone, Android Keystore runtime, Android TTS, or live OpenAI account test was available in the build workspace. Build/mock tests do not claim those device results.

APK SHA256: `8d32807658b247a08a5c0abedec2efc40b0bccb213e905a86cefea0129bedea4`  
Source ZIP SHA256: `811021b9da71dd315d703ad37947a7707d6984fafdacfebfc75025f80c1fd9a5`

These artifacts include the supplied assistant operating rules. They contain no user API credential or conversation history. The APK is signed with a local test certificate for sideload testing, not a Play Store production certificate. Samsung/Android installation policies may affect sideloading; follow your phone’s own prompts.

## Source and credits

The source ZIP includes build instructions, the native Java files, resources, tests, the operating-rule seed, two marketing references and complete license texts. The app also exports its own complete native source from Settings. Native application code is AGPL-3.0-or-later, without warranty. Marketing principles/content notes by Jared Rhodenizer retain CC BY-SA 4.0. This independent app is not endorsed by OpenAI, Samsung or Jared Rhodenizer. See the included `README.md` and `THIRD_PARTY_NOTICES.md` for details.
