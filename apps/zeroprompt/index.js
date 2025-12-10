// CRITICAL: Null safety polyfill MUST be INLINE and FIRST
// This patches Object.entries/keys/values to handle null values
// WalletConnect crashes with "Cannot convert null value to object" when storage returns null
// Using IIFE to ensure this runs before any imports are processed
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

  console.log('[null-safety] ✅ Object methods patched');
})();

import "react-native-get-random-values";
import "text-encoding";

// WalletConnect polyfills for React Native
import "@walletconnect/react-native-compat";

console.log('[index.js] ✅ All polyfills loaded');

import "expo-router/entry";
