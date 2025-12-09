import { Platform } from 'react-native';

// API URL configuration
// Production URL for deployed apps
const PRODUCTION_API_URL = 'https://api.0prompt.xyz';

// In development, defaults to localhost (or Android emulator IP)
const getDefaultApiUrl = () => {
  // For native apps (Android/iOS), always use production API
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    return PRODUCTION_API_URL;
  }
  // For web, check environment variable first, then default to localhost for dev
  return 'http://localhost:3001';
};

export const API_URL = process.env.EXPO_PUBLIC_API_URL || getDefaultApiUrl();

export default API_URL;
