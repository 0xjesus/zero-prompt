/**
 * Custom entry point that ensures polyfills run BEFORE any ES6 imports
 *
 * The problem: Babel hoists all `import` statements to the top of the file,
 * so any polyfill code placed before imports still runs AFTER them.
 *
 * Solution: Use CommonJS require() in a file with NO import statements.
 * This file becomes our entry point instead of expo-router/entry.
 */

// STEP 1: Patch Object.entries/keys/values for null safety
// WalletConnect crashes with "Cannot convert null value to object"
(function() {
  if (global.__nullSafetyPatched) return;
  global.__nullSafetyPatched = true;

  var _entries = Object.entries;
  var _keys = Object.keys;
  var _values = Object.values;

  Object.entries = function(o) {
    return (o == null) ? [] : _entries.call(Object, o);
  };
  Object.keys = function(o) {
    return (o == null) ? [] : _keys.call(Object, o);
  };
  Object.values = function(o) {
    return (o == null) ? [] : _values.call(Object, o);
  };

  console.log('[entry.js] ✅ Object.entries/keys/values patched for null');
})();

// STEP 2: Load crypto polyfills
require("react-native-get-random-values");
require("text-encoding");

// STEP 3: Load WalletConnect React Native compatibility layer
require("@walletconnect/react-native-compat");

console.log('[entry.js] ✅ All polyfills loaded');

// STEP 4: Load the actual app via expo-router
require("expo-router/entry");
