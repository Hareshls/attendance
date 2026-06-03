import React, { useState, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import api from '../services/api';

export default function RegisterScreen({ navigation }) {
  const [workerId, setWorkerId] = useState('');
  const [name, setName] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const cameraRef = useRef(null);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
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

  const submitRegistration = async () => {
    if (!workerId || !name || !photo) {
      Alert.alert("Error", "Please fill all fields and take a photo");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('worker_id', workerId);
      formData.append('name', name);
      
      // Convert URI to a Blob-like object for FormData
      formData.append('image', {
        uri: photo.uri,
        name: `photo_${workerId}.jpg`,
        type: 'image/jpeg'
      });

      const response = await api.post('/register', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      Alert.alert("Success", response.data.message || "Worker registered successfully");
      navigation.goBack();
    } catch (error) {
      const msg = error.response?.data?.detail || error.message;
      Alert.alert("Registration Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Register Worker</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Worker ID (e.g. EMP001)"
        placeholderTextColor="#a2a8d3"
        value={workerId}
        onChangeText={setWorkerId}
      />
      <TextInput
        style={styles.input}
        placeholder="Full Name"
        placeholderTextColor="#a2a8d3"
        value={name}
        onChangeText={setName}
      />

      {photo ? (
        <View style={styles.previewContainer}>
          <Text style={styles.previewText}>Photo Captured! ✅</Text>
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
            onCameraReady={() => setIsCameraReady(true)}
          />
          <View style={styles.cameraOverlay}>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureInner} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <TouchableOpacity 
        style={[styles.submitButton, loading && styles.disabledButton]} 
        onPress={submitRegistration}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Submit Registration</Text>
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
    marginBottom: 20,
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
    marginBottom: 20,
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
  submitButton: {
    backgroundColor: '#4caf50',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    boxShadow: '0px 2px 4px rgba(0,0,0,0.3)',
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: '#2e7d32',
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
