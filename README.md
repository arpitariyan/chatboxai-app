# 📱 ChatBox AI Mobile

<div align="center">

![ChatBox AI Logo](assets/images/logo.png)

### Production-Grade ChatGPT-Inspired Android Application
**Engineered with React Native, Expo SDK 57, TypeScript, Hermes Bytecode, and Stale-While-Revalidate Caching.**

[![Platform](https://img.shields.io/badge/Platform-Android%207.0%2B%20(API%2024--35)-green.svg?style=for-the-badge&logo=android)](https://www.android.com/)
[![React Native](https://img.shields.io/badge/React%20Native-0.86.3-61DAFB.svg?style=for-the-badge&logo=react)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo%20SDK-57-000020.svg?style=for-the-badge&logo=expo)](https://expo.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%206.0-3178C6.svg?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![APK Size](https://img.shields.io/badge/APK%20Size-~28%20MB-blueviolet.svg?style=for-the-badge)](#-low-end-mobile--compression-optimizations)

</div>

---

## 🌟 Overview

**ChatBox AI Mobile** is a high-performance, native-quality Android AI assistant application designed with the clean, restrained ergonomics of modern top-tier OTT/AI apps (ChatGPT, Claude). It pairs a zero-neon dark mode aesthetic with deep device optimizations, offering instant response streaming, multimodal camera/gallery vision, speech-to-text dictation, and standalone in-app auto-updates without third-party store dependencies.

---

## 🚀 Key Features

### 💬 1. Conversational AI & Streaming
- **Typewriter Streaming**: Native 60 FPS response streaming using `requestAnimationFrame`.
- **Reasoning / Thinking Blocks**: Collapsible thinking phases for complex multi-step reasoning models.
- **Rich Markdown & Syntax Highlighting**: Full tables, bullet lists, bold text, and copyable code blocks.
- **Message Action Bar**: Copy response, give feedback (thumbs up/down), regenerate answer, and read aloud.

### 📷 2. Multimodal Vision & Camera Integration
- **Direct Camera Capture**: Instant photo capture inside chat attachment menu with automatic compression (0.8 quality).
- **Multi-Image Selection**: Select up to 20 photos from the native gallery for simultaneous multimodal analysis.
- **Vision Model Support**: Ask the AI to solve mathematical equations, describe visual scenes, or summarize receipts and documents.

### 🎨 3. AI Image Generation & Gallery Export
- **Custom Artwork & Stickers**: Prompt-based image synthesis directly inside the app.
- **Aspect Ratio Selector**: Square (1:1), Portrait (9:16), Landscape (16:9), and standard photo ratios.
- **Direct Gallery Saving**: Save high-resolution AI generated images directly to the phone's photo library with one tap.

### 🎙️ 4. Interactive Voice AI & Dictation
- **Speech-to-Text Input**: Dictate prompts naturally with live speech transcription.
- **Real-Time Voice Mode**: Full-screen hands-free voice conversation mode featuring live audio waveform visualizations and responsive turn-taking.

### ⚡ 5. Stale-While-Revalidate (SWR) Instant Loading
- **0–10ms Startup Speed**: User profiles, credit balances (5,000 credits), and chat history load instantaneously from L1 in-memory cache and L2 local `AsyncStorage`.
- **Background Sync**: Silently revalidates and synchronizes data with Appwrite Cloud in the background without UI stutter or layout shift.
- **Resilient Timeout Control**: HTTP requests tuned to 8s/4s boundaries to prevent hangs on 2G/3G mobile networks.

### 📦 6. Low-End Mobile & Compression Optimizations
- **Smooth on 2GB RAM Devices**: Pre-configured with Android `largeHeap: true` (256MB+ heap headroom) and GPU hardware acceleration (`hardwareAccelerated: true`).
- **Hermes Ahead-Of-Time (AOT) Bytecode**: JavaScript is pre-compiled into `.hbc` bytecode during build time, eliminating runtime JIT memory footprint.
- **65% APK Size Shrink (~28 MB)**: ARM ABI filtering (`armeabi-v7a`, `arm64-v8a`) removes 50MB+ of unused desktop emulator binaries while guaranteeing 100% compatibility across physical Android phones.
- **R8 Full-Mode Obfuscation**: Code shrinking, resource stripping, and class repackaging enabled.

### 🔄 7. In-App Direct Auto-Update System
- **Over-The-Air (OTA) Updates**: Automatically checks `releases/latest.json` on app startup.
- **Home Screen Banner**: Dedicated update card appears right below suggestions on the Home/Chat screen when a new release is available.
- **One-Tap Update**: Downloads the APK in the background with a live progress bar, validates cryptographic **SHA-256** checksums, and launches the native Android Package Installer. No user data or chat logs are lost.

---

## 🔐 Android Permissions Architecture

ChatBox AI implements strict Android runtime permission models (compliant with Android 7.0 through Android 15):

| Permission | System Name | Features Powered |
|---|---|---|
| **Gallery** | `READ_MEDIA_IMAGES` / `READ_EXTERNAL_STORAGE` | Picking up to 20 images for AI analysis & saving artwork |
| **Camera** | `CAMERA` | Live camera photo capture in chat attachments |
| **Microphone** | `RECORD_AUDIO` | Speech-to-text dictation & real-time Voice AI mode |
| **Storage** | `WRITE_EXTERNAL_STORAGE` | Downloading APKs & exporting generated images |
| **Auto-Update** | `REQUEST_INSTALL_PACKAGES` | Triggering native in-place APK installation for updates |

*All permissions are requested just-in-time when the user triggers the corresponding feature, with clear human-readable permission rationale dialogs.*

---

## 🛠️ Tech Stack & Architecture

- **Core Framework**: React Native (0.86.3) with Expo SDK 57
- **Language**: TypeScript 6 (Strict Mode)
- **Navigation**: Native Stack & Slide-over Drawer with hardware-accelerated 60 FPS transitions
- **Styling**: Centralized Design System (`src/theme/`) mirroring ChatGPT dark aesthetics (`#18181b`, `#202024`, `#2a2a30`)
- **Icons**: Official Tabler Icons (`@tabler/icons-react-native` + `react-native-svg`)
- **Backend & Auth**:
  - Firebase Authentication (Email/Password, Google, GitHub, Microsoft)
  - Appwrite Cloud Database (`users`, `library`, `chats`, `mfa_otps`)
  - Resend API (HTML 6-digit OTP verification emails)
- **Local Storage**: `@react-native-async-storage/async-storage` + `expo-file-system`
- **Compiler & Bundler**: Metro Bundler + Hermes Engine + Android Gradle 9 with R8 Full Mode

---

## 📁 Project Directory Structure

```
Chatboxai_APK/
├── .github/workflows/          # Automated GitHub Actions APK build & release CI/CD
├── android/                    # Generated Android native Gradle project
├── assets/                     # App icons, splash screens, and brand imagery
├── docs/                       # Architectural documentation & operator cheat sheets
│   ├── APK_RELEASE_COMMANDS.md # Master guide for building and releasing APKs
│   ├── MEMORY.md               # Complete project memory and audit log
│   └── master-design-prompt.md # UI/UX design specifications
├── plugins/                    # Expo config plugins (withSecurityHardening.js)
├── scripts/                    # Release automation (bump-version.js)
├── src/
│   ├── components/             # Reusable UI components
│   │   ├── auth/               # Sign-in, sign-up, OTP & password input components
│   │   ├── chat/               # Composer, ChatBubble, AttachmentSheet, VoiceOverlay
│   │   ├── common/             # Header, Drawer, BottomSheet, UpdateBannerCard
│   │   └── settings/           # Modular categorized settings sections
│   ├── config/                 # Firebase, Appwrite, and environment configurations
│   ├── contexts/               # Unified AuthContext & session state management
│   ├── features/               # High-level screens (ChatScreen, ImageGenScreen)
│   ├── services/               # Decoupled business logic
│   │   ├── api/                # Network client with resilient timeout policies
│   │   ├── chatService.ts      # Multi-turn chat persistence with SWR caching
│   │   ├── userService.ts      # User profile synchronization with SWR caching
│   │   └── update/             # In-app APK updater and manifest validator
│   └── theme/                  # Theme tokens (colors, typography, spacing, radius)
├── app.json                    # Expo application manifest & native permissions
└── package.json                # Project dependencies and npm scripts
```

---

## 🚀 Building & Releasing the APK

### Automated GitHub CI/CD Release (Recommended)

To build and release an updated APK automatically:

```bash
# 1. Stage and commit changes
git add .
git commit -m "feat: your new feature"

# 2. Push to GitHub main branch
git push origin main
```

**What happens automatically:**
1. GitHub Actions triggers the release workflow.
2. Runs type checks (`npx tsc --noEmit`).
3. Automatically increments the `versionCode`.
4. Compiles the compressed standalone APK (~28 MB) with R8 Full Mode and ARM ABI filtering.
5. Publishes a new GitHub Release with the attached `.apk` asset.
6. Synchronizes `releases/latest.json`.
7. All installed apps receive the update notification on the Home Screen!

### Local Standalone APK Build (Local Machine)

```bash
# 1. Clean native Android generation
npx expo prebuild --platform android --clean

# 2. Compile standalone Release APK
cd android
./gradlew assembleRelease
```
The compiled APK will be located at:
`android/app/build/outputs/apk/release/app-release.apk`

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <b>Built with ❤️ by Arpit Ariyan</b>
</div>
