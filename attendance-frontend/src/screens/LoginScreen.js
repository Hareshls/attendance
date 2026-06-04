import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator, Animated } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';

export default function LoginScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const [step, setStep] = useState('form');
  const [workerId, setWorkerId] = useState('');
  const [dob, setDob] = useState('');
  const [loading, setLoading] = useState(false);

  const initiateFaceLogin = async () => {
    if (!workerId.trim() || !dob.trim()) {
      console.error("Login validation failed: Missing Worker ID or DOB");
      Alert.alert('Error', 'Please enter your Worker ID and Date of Birth');
      return;
    }
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Permission required', 'Camera access is needed for face login.');
        return;
      }
    }
    setStep('camera');
  };

  const captureAndLogin = async () => {
    if (!cameraRef.current) return;
    setLoading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, base64: true });
      setStep('verifying');
      
      const res = await apiService.workerFaceLogin({
        worker_id: workerId.trim(),
        password: dob.trim(),
        image_base64: photo.base64
      });

      if (res.success) {
        await AsyncStorage.setItem('worker_id', res.worker_id);
        await AsyncStorage.setItem('worker_name', res.name);
        navigation.replace('WorkerDashboard');
      } else {
        console.error("Login validation failed from server:", res.message);
        Alert.alert('Login Failed', res.message);
        setStep('form');
      }
    } catch (e) {
      console.error("Login validation failed due to network error:", e);
      Alert.alert('Error', 'Network error. Could not verify face login.');
      setStep('form');
    }
    setLoading(false);
  };

  if (step === 'camera' || step === 'verifying') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('form')} disabled={loading}>
            <Text style={styles.backBtn}>← BACK</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>FACE LOGIN</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.cameraSection}>
          <View style={styles.cameraFrame}>
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="front" />
            {step === 'verifying' && (
               <View style={styles.overlay}>
                 <ActivityIndicator size="large" color="#00FF9C" />
                 <Text style={styles.overlayText}>VERIFYING...</Text>
               </View>
            )}
          </View>
          
          {step === 'camera' && (
            <TouchableOpacity style={styles.captureBtn} onPress={captureAndLogin}>
              <View style={styles.captureBtnInner} />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>FIELD VERIFY</Text>
        <Text style={styles.subtitle}>Secure Workforce Attendance</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>WORKER ID</Text>
          <TextInput
            style={styles.input}
            value={workerId}
            onChangeText={setWorkerId}
            placeholder="e.g. W-1001"
            placeholderTextColor="rgba(255,255,255,0.2)"
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>DATE OF BIRTH (DDMMYYYY)</Text>
          <TextInput
            style={styles.input}
            value={dob}
            onChangeText={setDob}
            placeholder="e.g. 15081995"
            placeholderTextColor="rgba(255,255,255,0.2)"
            keyboardType="number-pad"
            maxLength={8}
            secureTextEntry
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>FACE AUTHENTICATION</Text>
          <Text style={{color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 12}}>
            Your biometric data will be verified for secure access.
          </Text>
        </View>

        <TouchableOpacity style={styles.btn} onPress={initiateFaceLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#0A0A0F" /> : <Text style={styles.btnText}>SCAN FACE TO LOGIN</Text>}
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => navigation.navigate('AdminLogin')} style={styles.adminWrap}>
        <Text style={styles.adminTxt}>🛡️ SUPERVISOR LOGIN</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F', justifyContent: 'center' },
  content: { paddingHorizontal: 24, justifyContent: 'center', flex: 1 },
  title: { color: '#FFF', fontSize: 40, fontWeight: '900', letterSpacing: -1, textAlign: 'center', marginBottom: 8 },
  subtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', marginBottom: 40, letterSpacing: 2 },
  inputGroup: { marginBottom: 20 },
  label: { color: 'rgba(255,255,255,0.3)', fontSize: 10, letterSpacing: 3, marginBottom: 8 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12, paddingHorizontal: 18, paddingVertical: 16,
    color: '#FFF', fontSize: 16
  },
  btn: {
    backgroundColor: '#FFF', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center', marginTop: 12
  },
  btnText: { color: '#0A0A0F', fontWeight: '800', letterSpacing: 1 },
  linkWrap: { marginTop: 32, alignItems: 'center' },
  linkTxt: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  adminWrap: { padding: 24, alignItems: 'center' },
  adminTxt: { color: 'rgba(255,255,255,0.2)', fontSize: 11, letterSpacing: 2 },
  
  // Camera styles
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 },
  backBtn: { color: 'rgba(255,255,255,0.4)', fontSize: 12, letterSpacing: 1, width: 60 },
  headerTitle: { color: '#FFF', fontSize: 13, letterSpacing: 4, fontWeight: '700' },
  cameraSection: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cameraFrame: { width: 300, height: 300, borderRadius: 150, overflow: 'hidden', backgroundColor: '#111', borderWidth: 2, borderColor: '#00FF9C' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  overlayText: { color: '#00FF9C', marginTop: 12, letterSpacing: 2, fontWeight: '700' },
  captureBtn: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  captureBtnInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#FFF' },
});
