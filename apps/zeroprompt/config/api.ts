import { Platform } from 'react-native';

// API URL configuration
// Production URL for deployed apps - ALWAYS use this for native builds
const PRODUCTION_API_URL = 'https://api.0prompt.xyz';

// Get the API URL based on platform
const getApiUrl = () => {
  // For native apps (Android/iOS), ALWAYS use production API
  // This is critical - native apps cannot connect to localhost
  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    console.log('[API Config] Native platform detected, using production API:', PRODUCTION_API_URL);
    return PRODUCTION_API_URL;
  }

  // For web in production (deployed), use production API
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname !== 'localhost') {
    console.log('[API Config] Web production detected, using production API:', PRODUCTION_API_URL);
    return PRODUCTION_API_URL;
  }

  // For web in development (localhost), use localhost
  console.log('[API Config] Web development detected, using localhost');
  return 'http://localhost:3001';
};

export const API_URL = getApiUrl();
export const SUBNET_API_URL = 'https://subnet.qcdr.io';

console.log('[API Config] Final API_URL:', API_URL);

export default API_URL;
