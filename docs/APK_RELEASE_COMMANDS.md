# 🚀 ChatBox AI Mobile — APK Build & GitHub Auto-Release Cheat Sheet

> **Yeh file future updates ke liye permanent guide hai.** Jab bhi aapko naya APK release karna ho, bas yahan se exact commands copy-paste karke run karo.

---

## 📌 Short Answer (Aapka Sawaal: "Kya GitHub se automatic ho payega?")

**HAAN, 100% AUTOMATIC HO JAYEGA!**
Aapko GitHub website par jakar manually APK file drag-and-drop karne ki bhi zaroorat nahi hai. 

Jab aap apne computer se `git push origin main` karoge:
1. GitHub Actions automatically start ho jayega.
2. Code check karega (`npx tsc --noEmit`).
3. Version Code ko automatically badhayega (e.g., `1` ➔ `2` ➔ `3`).
4. Standalone compressed APK (**~25 se 35 MB**) build karega Hermes engine + R8 full-mode optimization ke sath.
5. GitHub Releases section mein automatically **New Release (v1.0.X)** create karke `.apk` file attach kar dega!
6. Jin users ke phone mein app installed hai, unke Home Screen par green-marked area mein **"Update Available"** ka banner dikh jayega!

---

## ✅ KONSE COMMANDS USE KARNA HAI (Recommended)

### 🌟 METHOD 1: 100% Fully Automatic (Sirf 3 Commands)
Jab bhi aapne code mein koi change ya feature add kiya aur chahte ho ki automatic APK ban kar GitHub par release ho jaye:

```bash
# Step 1: Sabhi changes stage karo
git add .

# Step 2: Update ka message likho
git commit -m "feat: new update release"

# Step 3: GitHub par push karo (Isi se build & release trigger hoga!)
git push origin main
```
> ⏱️ **Result:** GitHub Actions (~10-15 minute) mein APK build karke Releases tab mein upload kar dega aur live update users ko mil jayega!

---

### 🏷️ METHOD 2: Specific Version Dena Ho (e.g. v1.0.2 ya v1.1.0)
Agar aap chahte ho ki version number exact aapki pasand ka ho (jaise `1.0.2`):

```bash
# Step 1: Version bump script run karo (Yeh app.json, package.json aur release configs update karega)
node scripts/bump-version.js 1.0.2

# Step 2: Commit karo
git add .
git commit -m "chore(release): bump version to 1.0.2"

# Step 3: Push karo
git push origin main
```

---

### 💻 METHOD 3: Apne Laptop Par Local APK Build Karna (EAS Cloud Build)
Agar aapko apne laptop par hi direct standalone `.apk` download link chahiye:

```bash
# Production standalone APK build command:
eas build -p android --profile production
```
> 💡 Build complete hone ke baad terminal mein seedha `.apk` download link mil jayega.

---

### 🛠️ METHOD 4: Offline / Local Android Studio (Gradle) Build
Agar bina EAS ke apne hi computer par direct APK generate karna ho:

```bash
# Step 1: Native Android project generate karo
npx expo prebuild --platform android --clean

# Step 2: Release APK compile karo
cd android
./gradlew assembleRelease

# (Windows Command Prompt ke liye: gradlew.bat assembleRelease)
```
> 📁 **Aapka ready APK yahan milega:**
> `android/app/build/outputs/apk/release/app-release.apk`
> Size: **~25 MB to 35 MB** (Hermes Bytecode + ARM ABI Stripped).

---

## ❌ KONSE COMMANDS KABHI BHI USE NAHI KARNA (Avoid These)

| Galat Command | Kyun use NAHI karna? |
|---|---|
| ❌ `npx expo build:android` | Yeh purana deprecated command hai, Expo SDK 57 par fail ho jayega. |
| ❌ `eas build --profile development` | Yeh **Debug** APK banata hai (150MB+ size, koi compression nahi, bohot slow). |
| ❌ `./gradlew assembleDebug` | Debug build hai, R8 shrinking band hoti hai, 2GB RAM phones par lag karega. |
| ❌ `npx expo export` (standalone ke liye) | Yeh sirf JS bundle export karta hai, installable `.apk` file nahi banata. |

---

## 🌐 GitHub Website Se Manual Release Karna (Agar UI Se Karna Chaho)

Agar aap GitHub website par jakar release karna chahte ho (jo aapne screenshot text mein pucha):

1. Apne GitHub repo par jao: `https://github.com/arpitariyan/chatboxai-app`
2. Right side mein **Releases** par click karo ➔ **Draft a new release**.
3. **Choose a tag:** Type karo `v1.0.1` (ya `v1.0.2`) ➔ Click *Create new tag*.
4. **Release title:** Type karo `ChatBox AI Mobile v1.0.1`.
5. **Attach binaries:** Apna locally build kiya hua `app-release.apk` drag-and-drop karke attach kar do.
6. **Publish release** button par click kar do.
7. Bas! Mobile app automatically GitHub se naya version detect karke user ke Home Screen par **"Update Available"** card dikha dega.

---

## 📱 Mobile Screen Par Update Kaise Dikhaye Dega?
- **Location:** Home screen par `Brainstorm ideas` prompt card ke theek niche aur bottom chat box ke upar (Aapke green mark kiye huye slot mein).
- **Features:**
  - Violet theme card (`Update Available v1.0.1`).
  - **"Update Now"** button dabate hi card ke andar live download progress bar dikhta hai (`Downloading APK... 65%`).
  - Download complete hote hi Android system package installer open ho jata hai.
  - User "Install" dabata hai aur app update ho jata hai!
