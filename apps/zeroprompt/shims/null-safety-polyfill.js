/**
 * Global null safety polyfill for Object.entries, Object.keys, and Object.values
 *
 * WalletConnect crashes with "Cannot convert null value to object" when
 * storage returns null values. This polyfill patches Object methods at
 * the global level to handle null/undefined gracefully.
 *
 * This file MUST be required (not imported) FIRST in index.js
 */
(function() {
  'use strict';

  // Prevent double-patching
  if (global.__nullSafetyPatched) {
    return;
  }
  global.__nullSafetyPatched = true;

  var originalObjectEntries = Object.entries;
  var originalObjectKeys = Object.keys;
  var originalObjectValues = Object.values;

  Object.entries = function(obj) {
    if (obj === null || obj === undefined) {
      return [];
    }
    return originalObjectEntries.call(Object, obj);
  };

  Object.keys = function(obj) {
    if (obj === null || obj === undefined) {
      return [];
    }
    return originalObjectKeys.call(Object, obj);
  };

  Object.values = function(obj) {
    if (obj === null || obj === undefined) {
      return [];
    }
    return originalObjectValues.call(Object, obj);
  };

  console.log('[null-safety] ✅ Object.entries/keys/values patched');
})();
