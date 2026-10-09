const {
  withDangerousMod,
  withAndroidManifest,
  withGradleProperties,
  withAppBuildGradle,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Custom Expo Config Plugin for Comprehensive Android Security & Hardening:
 * 1. Generates custom ProGuard/R8 obfuscation rules with aggressive class repackaging and log stripping
 * 2. Creates Android Network Security Configuration (enforcing HTTPS, blocking cleartext in production)
 * 3. Configures AndroidManifest security attributes (allowBackup="false", extractNativeLibs="false")
 * 4. Enables R8 Full Mode in gradle.properties for maximum compiler-level code shrinking and obfuscation
 */
const withSecurityHardening = (config) => {
  // 1. ProGuard Rules for R8 code shrinking, obfuscation, and log stripping
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const proguardPath = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'proguard-rules.pro'
      );

      const securityProguardRules = `
# -------------------------------------------------------------
# ChatBox AI APK — Production R8 / ProGuard Hardening Rules
# -------------------------------------------------------------

# Enable aggressive class and member obfuscation into a single flat package
-repackageclasses 'com.chatboxai.app.o'
-allowaccessmodification

# Optimization settings
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-verbose

# Strip debugging logs from bytecode in production
-assumenosideeffects class android.util.Log {
    public static boolean isLoggable(java.lang.String, int);
    public static int v(...);
    public static int d(...);
    public static int i(...);
}

# Protect React Native and Hermes internals
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Protect Expo modules and reflection
-keep class expo.modules.** { *; }
-keep class * extends expo.modules.core.BasePackage { *; }

# Protect cryptographic providers and SecureStore
-keep class androidx.security.crypto.** { *; }
-keep class expo.modules.securestore.** { *; }

# Protect OkHttp & network models
-dontwarn okhttp3.**
-dontwarn okio.**
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Prevent reverse-engineering of line numbers and source file names
-renamesourcefileattribute SourceFile
-keepattributes SourceFile,LineNumberTable
`;

      try {
        let existing = '';
        if (fs.existsSync(proguardPath)) {
          existing = fs.readFileSync(proguardPath, 'utf8');
        }
        if (!existing.includes('ChatBox AI APK — Production R8')) {
          fs.writeFileSync(proguardPath, existing + '\n' + securityProguardRules, 'utf8');
        }
      } catch (err) {
        // Ignored during standard export if android directory not prebuilt yet
      }

      // 2. Android Network Security Configuration XML
      const resXmlDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );

      const networkSecurityXml = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <!-- Base config: Cleartext traffic is strictly forbidden in production -->
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>

    <!-- Specific secure domains -->
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">chatboxai.co.in</domain>
        <domain includeSubdomains="true">api-mobile.chatboxai.co.in</domain>
        <domain includeSubdomains="true">cloud.appwrite.io</domain>
        <domain includeSubdomains="true">firebaseio.com</domain>
        <domain includeSubdomains="true">googleapis.com</domain>
    </domain-config>

    <!-- Debug overrides: Permit localhost/LAN only in debug builds -->
    <debug-overrides>
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </debug-overrides>
</network-security-config>
`;

      try {
        if (!fs.existsSync(resXmlDir)) {
          fs.mkdirSync(resXmlDir, { recursive: true });
        }
        const xmlPath = path.join(resXmlDir, 'network_security_config.xml');
        fs.writeFileSync(xmlPath, networkSecurityXml, 'utf8');
      } catch (err) {
        // Ignored if android directory not prebuilt yet
      }

      return config;
    },
  ]);

  // 3. AndroidManifest: Attach security attributes & auto-update install permission
  config = withAndroidManifest(config, async (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];
    if (mainApplication) {
      mainApplication.$['android:networkSecurityConfig'] = '@xml/network_security_config';
      mainApplication.$['android:allowBackup'] = 'false';
      mainApplication.$['android:extractNativeLibs'] = 'false';
    }

    // Ensure REQUEST_INSTALL_PACKAGES permission for seamless Android 8.0+ self-updates
    if (!config.modResults.manifest['uses-permission']) {
      config.modResults.manifest['uses-permission'] = [];
    }
    const hasInstallPermission = config.modResults.manifest['uses-permission'].some(
      (p) => p.$['android:name'] === 'android.permission.REQUEST_INSTALL_PACKAGES'
    );
    if (!hasInstallPermission) {
      config.modResults.manifest['uses-permission'].push({
        $: { 'android:name': 'android.permission.REQUEST_INSTALL_PACKAGES' },
      });
    }

    return config;
  });

  // 4. Force minSdkVersion = 24 (Android 7.0+) baseline compatibility & aggressive APK size optimization
  config = withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;
    if (contents.includes('minSdkVersion')) {
      contents = contents.replace(/minSdkVersion\s*=\s*\d+/g, 'minSdkVersion = 24');
      contents = contents.replace(/minSdkVersion\s+\d+/g, 'minSdkVersion 24');
    }

    // Enable NDK ABI filters to exclude bloated x86/x86_64 desktop emulator binaries from release APK
    if (contents.includes('defaultConfig {') && !contents.includes('abiFilters')) {
      contents = contents.replace(
        'defaultConfig {',
        `defaultConfig {
        ndk {
            abiFilters "armeabi-v7a", "arm64-v8a"
        }`
      );
    }

    // Enable shrinkResources for release build to purge unused drawables & strings
    if (contents.includes('buildTypes {') && contents.includes('release {')) {
      if (!contents.includes('shrinkResources')) {
        contents = contents.replace(
          /buildTypes\s*\{\s*release\s*\{/g,
          `buildTypes {
        release {
            shrinkResources true
            minifyEnabled true`
        );
      }
    }

    config.modResults.contents = contents;
    return config;
  });

  // 5. Enable R8 Full Mode for enhanced code shrinking and class hierarchy flattening
  config = withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) => item.key !== 'android.enableR8.fullMode' && item.key !== 'org.gradle.jvmargs'
    );
    config.modResults.push({
      type: 'property',
      key: 'android.enableR8.fullMode',
      value: 'true',
    });
    config.modResults.push({
      type: 'property',
      key: 'org.gradle.jvmargs',
      value: '-Xmx4096m -XX:MaxMetaspaceSize=1024m',
    });
    return config;
  });

  return config;
};

module.exports = withSecurityHardening;
