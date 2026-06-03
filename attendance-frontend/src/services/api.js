import axios from 'axios';
import { Platform } from 'react-native';

// Important: If running on a physical device, replace '10.0.2.2' (Android emulator)
// or 'localhost' (iOS simulator) with your computer's local IP address (e.g. 'http://192.168.1.100:8000/api/v1')
const getBaseUrl = () => {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:8000/api/v1';
  }
  return 'http://localhost:8000/api/v1';
};

const api = axios.create({
  baseURL: getBaseUrl(),
});

export default api;
