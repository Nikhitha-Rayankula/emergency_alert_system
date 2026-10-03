import { Platform } from 'react-native';

// Production URL (via EXPO_PUBLIC_API_URL environment variable or deployed domain)
// Development: Localhost for web, Wi-Fi IP for physical Android/Expo Go, or 10.0.2.2 for emulator.

const DEV_MACHINE_IP = '10.105.169.48';
const PORT = '8000';

function getBackendUrl() {
  if (process.env.EXPO_PUBLIC_API_URL) {
    const raw = process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
    return raw.endsWith('/api/auth') ? raw : `${raw}/api/auth`;
  }
  if (Platform.OS === 'web') {
    return `http://localhost:${PORT}/api/auth`;
  }
  return `http://${DEV_MACHINE_IP}:${PORT}/api/auth`;
}

export const BASE_URL = getBackendUrl();