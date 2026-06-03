import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import api from '../services/api';

export default function CheckInScreen({ navigation }) {
  const [workerId, setWorkerId] = useState('');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState(null);
  
  const [photo, setPhoto] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const cameraRef = useRef(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);
      }
    })();
  }, []);

  if (!cameraPermission || locationPermission === null) {
    return <View style={styles.container} />;
  }

  if (!cameraPermission.granted || !locationPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need Camera and Location permissions to check in.</Text>
        <TouchableOpacity style={styles.button} onPress={requestCameraPermission}>
          <Text style={styles.buttonText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const data = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.5,
        });
        setPhoto(data);
      } catch (err) {
        Alert.alert("Error", "Failed to capture image");
      }
    }
  };

  const submitCheckIn = async () => {
    if (!workerId || !photo) {
      Alert.alert("Error", "Please enter Worker ID and take a photo");
      return;
    }

    if (!location) {
      Alert.alert("Error", "Location not acquired yet. Please wait.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        worker_id: workerId,
        image_base64: photo.base64,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: new Date().toISOString(),
        site_lat: 17.4532, // Default from backend
        site_lon: 78.3821,
        ear_value: 0.20,
        response_latency: 280.0,
        challenge: "blink",
        is_mock_location: location.mocked || false,
        wifi_bssids: []
      };

      const response = await api.post('/attendance/checkin', payload);
      
      const { success, message, similarity, risk_level, in_zone } = response.data;
      
      if (success) {
        Alert.alert(
          "Check-in Successful ✅", 
          `Match: ${similarity}%\nRisk: ${risk_level}\nIn Zone: ${in_zone ? 'Yes' : 'No'}`,
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert("Check-in Failed ❌", message || "Unknown error");
      }
      
    } catch (error) {
      const msg = error.response?.data?.detail || error.response?.data?.message || error.message;
      Alert.alert("Check-in Error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mark Attendance</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Worker ID (e.g. EMP001)"
        placeholderTextColor="#a2a8d3"
        value={workerId}
        onChangeText={setWorkerId}
      />

      {photo ? (
        <View style={styles.previewContainer}>
          <Text style={styles.previewText}>Selfie Ready! ✅</Text>
          <TouchableOpacity style={styles.retakeButton} onPress={() => setPhoto(null)}>
            <Text style={styles.buttonText}>Retake Photo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cameraContainer}>
          <CameraView 
            style={styles.camera} 
            facing="front"
            ref={cameraRef}
          />
          <View style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {location && (
        <Text style={styles.locationText}>
          📍 Location: {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
        </Text>
      )}

      <TouchableOpacity 
        style={[styles.submitButton, loading && styles.disabledButton]} 
        onPress={submitCheckIn}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Submit Check-in</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#16213e',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  message: {
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 16,
  },
  input: {
    backgroundColor: '#0f3460',
    color: '#fff',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  cameraContainer: {
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 20,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
  },
  previewContainer: {
    height: 300,
    backgroundColor: '#0f3460',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  previewText: {
    color: '#4caf50',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  retakeButton: {
    backgroundColor: '#e94560',
    padding: 12,
    borderRadius: 8,
  },
  locationText: {
    color: '#a2a8d3',
    textAlign: 'center',
    marginBottom: 20,
    fontSize: 14,
  },
  submitButton: {
    backgroundColor: '#e94560',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    boxShadow: '0px 2px 4px rgba(0,0,0,0.3)',
    elevation: 5,
  },
  button: {
    backgroundColor: '#0f3460',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#8a2b3b',
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
