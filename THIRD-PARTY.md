# Dependencies and architectural references

This desktop implementation is original code, not an installation, fork or bundled copy of the six reference repositories. It does not require Claude Code. It does not include Barehands gesture tracking or the marketing playbooks.

The following repository documentation informed the architecture:
- https://github.com/jaredrhod/ai-memory-vault — markdown memory, index and daily checkpoints (CC BY-SA 4.0).
- https://github.com/jaredrhod/fullstack-agent — separation of memory, voice and visualization (AGPL-3.0-or-later).
- https://github.com/jaredrhod/backtalk — push-to-talk, interruption and explicit action permissions (AGPL-3.0-or-later).
- https://github.com/jaredrhod/ai-visualizer — idle, listening, thinking and speaking states (AGPL-3.0-or-later).
- https://github.com/jaredrhod/barehands — local workspace and explicit action interface (AGPL-3.0-or-later).
- https://github.com/jaredrhod/ai-marketing-skills — task-specific context (CC BY-SA 4.0).

Repository wizards and embedded instructions were not executed. The user's working rules were supplied separately by the user and implemented directly.

Electron is MIT-licensed and bundles Chromium, Node.js and their notices. Those notices ship with the application. electron-builder (MIT) is a build dependency. Playwright (Apache-2.0) is used only for development checks. See node_modules for dependency licenses when working from source.

Groq, OpenAI and Fish Audio are independent cloud services. API usage requires your own account, key, access and any applicable credits. This app does not include a subscription or connect to a ChatGPT subscription automatically.
