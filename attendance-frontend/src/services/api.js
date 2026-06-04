import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Change this to your backend IP when testing on real device ──
// For iOS Simulator: use localhost
// For Android Emulator: use 10.0.2.2
const BASE_URL = 'http://192.168.1.110:8000/api/v1';

const TIMEOUT = 8000; // 8 seconds timeout

const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
};

export const apiService = {

  // ── Worker Login ──
  workerLogin: async (workerId, password) => {
    const formData = new FormData();
    formData.append('worker_id', workerId);
    formData.append('password', password);
    
    const response = await fetchWithTimeout(`${BASE_URL}/worker/login`, {
      method: 'POST',
      body: formData,
    });
    return response.json();
  },

  // ── Worker Face Login ──
  workerFaceLogin: async (data) => {
    const response = await fetchWithTimeout(`${BASE_URL}/worker/face-login`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(data),
    });
    return response.json();
  },

  // ── Register new worker ──
  register: async (data) => {
    const formData = new FormData();
    formData.append('worker_id', data.worker_id);
    formData.append('name', data.worker_name);
    formData.append('password', data.password || '');
    if (data.role) formData.append('role', data.role);
    if (data.phone) formData.append('phone', data.phone);
    if (data.department) formData.append('department', data.department);
    
    // In React Native, FormData accepts an object with uri, type, name for files
    formData.append('image', {
      uri: `data:image/jpeg;base64,${data.image_base64}`,
      type: 'image/jpeg',
      name: 'face.jpg',
    });

    const response = await fetchWithTimeout(`${BASE_URL}/register`, {
      method : 'POST',
      body   : formData,
    });
    return response.json();
  },

  // ── Check in ──
  checkIn: async (data) => {
    const response = await fetchWithTimeout(`${BASE_URL}/attendance/checkin`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(data),
    });
    return response.json();
  },

  // ── Get unsynced records ──
  getUnsynced: async () => {
    const response = await fetchWithTimeout(`${BASE_URL}/attendance/unsynced`);
    return response.json();
  },

  // ── Mark records as synced ──
  markSynced: async (ids) => {
    const response = await fetchWithTimeout(`${BASE_URL}/attendance/mark-synced`, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify(ids),
    });
    return response.json();
  },

  // ── Verify hash chain ──
  verifyChain: async () => {
    const response = await fetchWithTimeout(`${BASE_URL}/attendance/verify-chain`);
    return response.json();
  },

  // ── Admin Login (Mocked) ──
  adminLogin: async (username, password) => {
    // In a real app, this would hit the backend. For now, hardcode admin/admin123
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (username === 'admin' && password === 'admin123') {
          resolve({ success: true, token: 'fake-jwt-token' });
        } else {
          resolve({ success: false, message: 'Invalid credentials' });
        }
      }, 500);
    });
  },

  // ── Get Supervisor Data ──
  getSupervisorData: async () => {
    const response = await fetchWithTimeout(`${BASE_URL}/attendance/all`);
    return response.json();
  },
};