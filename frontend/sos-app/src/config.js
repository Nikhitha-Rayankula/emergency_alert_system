import { Platform } from 'react-native';

// Your PC's Wi-Fi IPv4 from ipconfig.
// When testing on Android Emulator: uses 10.0.2.2.
// When testing on Web/Desktop: uses localhost.
// When testing on Physical Device via Expo Go: uses Wi-Fi IPv4 (10.105.169.48).

const DEV_MACHINE_IP = '10.105.169.48';
const PORT = '8000';

function getBackendUrl() {
  if (Platform.OS === 'web') {
    return `http://localhost:${PORT}/api/auth`;
  }
  return `http://${DEV_MACHINE_IP}:${PORT}/api/auth`;
}

export const BASE_URL = getBackendUrl();