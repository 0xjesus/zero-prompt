import { Platform } from 'react-native';

// API URL configuration
// In production, uses EXPO_PUBLIC_API_URL environment variable
// In development, defaults to localhost (or Android emulator IP)

const getDefaultApiUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3001'; // Android emulator
  }
  return 'http://localhost:3001';
};

export const API_URL = process.env.EXPO_PUBLIC_API_URL || getDefaultApiUrl();

export default API_URL;
