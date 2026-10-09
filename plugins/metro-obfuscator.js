/**
 * plugins/metro-obfuscator.js
 *
 * Production Metro Minifier & JavaScript Obfuscator:
 * - In Development: Uses fast standard Terser minification without overhead.
 * - In Production: Applies aggressive JavaScript obfuscation (hexadecimal mangling,
 *   control-flow flattening, base64 string array virtualization, object key transformation)
 *   before Hermes bytecode compilation.
 *
 * Deters decompilation, reverse-engineering, and tampering of application code.
 */

const terser = require('metro-minify-terser');
const JavaScriptObfuscator = require('javascript-obfuscator');

const isProduction =
  process.env.NODE_ENV === 'production' ||
  process.env.BABEL_ENV === 'production' ||
  process.env.EAS_BUILD_PROFILE === 'production' ||
  process.env.EAS_BUILD_PROFILE === 'preview';

module.exports = async function obfuscateMinifier(options) {
  const { code, map, reserved, config = {} } = options;

  // Development: Fast standard Terser minification
  if (!isProduction) {
    return terser(options);
  }

  // Production: Multi-stage obfuscation
  try {
    const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.5,
      deadCodeInjection: false, // Keep bundle lean
      debugProtection: false,   // Avoid Hermes strict mode event loop conflicts
      disableConsoleOutput: true,
      identifierNamesGenerator: 'hexadecimal',
      log: false,
      renameGlobals: false,     // Protect React Native global bridging
      rotateStringArray: true,
      stringArray: true,
      stringArrayEncoding: ['base64'],
      stringArrayThreshold: 0.75,
      transformObjectKeys: true,
      unicodeEscapeSequence: false,
    });

    const obfuscatedCode = obfuscationResult.getObfuscatedCode();

    // Pass through Terser for final minification
    return terser({
      ...options,
      code: obfuscatedCode,
    });
  } catch (err) {
    console.warn('[MetroObfuscator] Obfuscation fallback to Terser:', err.message);
    return terser(options);
  }
};
