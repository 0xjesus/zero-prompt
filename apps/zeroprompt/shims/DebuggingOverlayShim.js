// Shim for DebuggingOverlayNativeComponent (RN 0.74.x bug fix)
import * as React from 'react';
import { View } from 'react-native';

const DebuggingOverlay = React.forwardRef((props, ref) => {
  return null;
});

DebuggingOverlay.displayName = 'DebuggingOverlay';

export default DebuggingOverlay;
