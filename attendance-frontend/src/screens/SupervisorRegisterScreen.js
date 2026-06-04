import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Animated, Alert, ScrollView, Dimensions
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';
import { DatabaseService } from '../services/DatabaseService';
import { initTFJS } from '../utils/tfjsSetup';
import * as tf from '@tensorflow/tfjs';
import * as faceapi from 'face-api.js';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';
import { Buffer } from 'buffer';
import * as ImageManipulator from 'expo-image-manipulator';

const { width } = Dimensions.get('window');

const ROLE_MAPPINGS = {
  'Site Engineer': 'Civil',
  'Electrician': 'Electrical',
  'Plumber': 'Plumbing',
  'Security': 'Operations',
  'Welder': 'Mechanical',
  'Supervisor': 'Management'
};

export default function SupervisorRegisterScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const hasPermission = permission?.granted;
  const camera = useRef(null);

  const [step, setStep]         = useState('form');   // form|capture|done
  const [workerId, setWorkerId] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [role, setRole]         = useState('');
  const [phone, setPhone]       = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading]   = useState(false);
  const [captured, setCaptured] = useState(0);        // how many photos taken
  const [photos, setPhotos]     = useState([]);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
    
    // Initialize Offline DB and TFJS
    const initOfflineDependencies = async () => {
      await DatabaseService.init();
      await initTFJS();
    };
    initOfflineDependencies();
  }, []);

  const shake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,   duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const goToCapture = async () => {
    if (!workerId.trim() || !workerName.trim() || !role.trim() || !department.trim()) {
      shake();
      console.error("Registration validation failed: Missing Info (ID, Name, Role, Dept)");
      Alert.alert('Missing Info', 'Please fill in all required fields (ID, Name, Role)');
      return;
    }
    
    if (!hasPermission) {
      const result = await requestPermission();
      if (!result) {
        Alert.alert('Permission required', 'Camera access is needed to capture your face.');
        return;
      }
    }
    
    setStep('capture');
  };
  const capturePhoto = async () => {
    if (!camera.current) return;
    try {
      setLoading(true);
      const photo = await camera.current.takePictureAsync({ base64: true, quality: 0.5 });
      
      // Upload to server for instant extraction
      const apiResult = await apiService.register({
        worker_id: workerId.trim(),
        worker_name: workerName.trim(),
        role: role.trim(),
        department: department.trim(),
        photo_uri: resizedPhoto.uri // Use shrunk image so upload takes 10ms
      });

      if (!apiResult.success) {
        setLoading(false);
        Alert.alert('Server Error', apiResult.message || 'Failed to extract face');
        return;
      }

      // Save worker to local encrypted SQLite for OFFLINE Check-ins
      const worker = {
        worker_id   : workerId.trim(),
        worker_name : workerName.trim(),
        dob         : '',
        role        : role.trim(),
        phone       : phone.trim(),
        department  : department.trim(),
        image_base64: base64Data,
        embedding   : apiResult.embedding,
      };

      const result = await DatabaseService.saveWorkerLocally(worker);

      if (result.success) {
        setStep('done');
      } else {
        Alert.alert('Local DB Error', result.error || 'Failed to save locally');
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Network Error', 'Could not connect to the server for registration.');
    } finally {
      setLoading(false);
    }
  };

  // ── DONE SCREEN ──
  if (step === 'done') {
    return (
      <View style={styles.container}>
        <View style={styles.doneCard}>
          <View style={styles.doneIconWrap}>
            <Text style={styles.doneIcon}>◈</Text>
          </View>
          <Text style={styles.doneTitle}>REGISTERED</Text>
          <Text style={styles.doneName}>{workerName.toUpperCase()}</Text>
          <Text style={styles.doneId}>ID: {workerId}</Text>
          <View style={styles.doneDivider} />
          <Text style={styles.doneMsg}>
            Face profile saved securely.{'\n'}The worker can now log in.
          </Text>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={() => navigation.replace('SupervisorDashboard')}
          >
            <Text style={styles.doneBtnText}>BACK TO DASHBOARD  →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── CAPTURE SCREEN ──
  if (step === 'capture') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('form')}>
            <Text style={styles.backBtn}>← BACK</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>FACE SETUP</Text>
          <View style={{ width: 60 }} />
        </View>

        <View style={styles.captureSection}>
          {/* Photo counter */}
          <View style={styles.photoCounter}>
            {[0].map(i => (
              <View key={i} style={[
                styles.photoDot,
                { backgroundColor: i < captured ? '#00FF9C' : 'rgba(255,255,255,0.15)' }
              ]} />
            ))}
          </View>

          <Text style={styles.captureInstruction}>
            {captured === 0 && 'LOOK STRAIGHT AT CAMERA'}
            {captured === 1 && 'PROCESSING...'}
          </Text>

          {/* Camera */}
          <View style={styles.cameraBox}>
            <CameraView
              ref={camera}
              style={StyleSheet.absoluteFill}
              facing="front"
            />
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
            <View style={styles.faceGuide} />
          </View>

          {/* Capture button */}
          {!loading ? (
            <TouchableOpacity style={styles.captureBtn} onPress={capturePhoto}>
              <View style={styles.captureBtnInner} />
            </TouchableOpacity>
          ) : (
            <View style={styles.loadingBox}>
              <Text style={styles.loadingText}>REGISTERING...</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── FORM SCREEN ──
  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>← BACK</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ENROLL WORKER</Text>
          <View style={{ width: 60 }} />
        </View>

        <Animated.View style={[
          styles.formSection,
          { transform: [{ translateX: shakeAnim }] }
        ]}>
          <Text style={styles.formTitle}>ENROLL{'\n'}WORKER</Text>
          <View style={styles.formTitleLine} />
          <Text style={styles.formSubtitle}>
            One time setup. Takes 30 seconds.
          </Text>

          {/* Worker ID */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>WORKER ID</Text>
            <TextInput
              style={styles.input}
              value={workerId}
              onChangeText={setWorkerId}
              placeholder="e.g. W-1001"
              placeholderTextColor="rgba(255,255,255,0.2)"
              autoCapitalize="characters"
            />
          </View>

          {/* Worker Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>FULL NAME</Text>
            <TextInput
              style={styles.input}
              value={workerName}
              onChangeText={setWorkerName}
              placeholder="e.g. Ravi Kumar"
              placeholderTextColor="rgba(255,255,255,0.2)"
            />
          </View>



          {/* Role Selection */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>SELECT ROLE</Text>
            <View style={styles.roleGrid}>
              {Object.keys(ROLE_MAPPINGS).map(r => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleBtn, role === r && styles.roleBtnActive]}
                  onPress={() => {
                    setRole(r);
                    setDepartment(ROLE_MAPPINGS[r]);
                  }}
                >
                  <Text style={[styles.roleBtnTxt, role === r && styles.roleBtnTxtActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Phone */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>PHONE NUMBER (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="e.g. +91 9876543210"
              placeholderTextColor="rgba(255,255,255,0.2)"
              keyboardType="phone-pad"
            />
          </View>

          {/* Info box */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>WHAT HAPPENS NEXT</Text>
            <Text style={styles.infoItem}>◦  1 face photo captured</Text>
            <Text style={styles.infoItem}>◦  Face converted to 128 numbers</Text>
            <Text style={styles.infoItem}>◦  Encrypted and saved on device</Text>
            <Text style={styles.infoItem}>◦  No photos stored — only numbers</Text>
          </View>

          <TouchableOpacity style={styles.nextBtn} onPress={goToCapture}>
            <Text style={styles.nextBtnText}>NEXT: CAPTURE FACE  →</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}

const FRAME = width * 0.72;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  backBtn: { color: 'rgba(255,255,255,0.4)', fontSize: 12, letterSpacing: 1, width: 60 },
  headerTitle: { color: '#FFFFFF', fontSize: 13, letterSpacing: 4, fontWeight: '700' },
  formSection: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  formTitle: { fontSize: 48, fontWeight: '900', color: '#FFFFFF', lineHeight: 50 },
  formTitleLine: { width: 40, height: 3, backgroundColor: '#00FF9C', marginVertical: 12 },
  formSubtitle: { color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 32 },
  inputGroup: { marginBottom: 20 },
  inputLabel: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 10,
    letterSpacing: 3,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  roleBtn: { 
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', 
    borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 
  },
  roleBtnActive: { backgroundColor: 'rgba(0,255,156,0.1)', borderColor: '#00FF9C' },
  roleBtnTxt: { color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: '600' },
  roleBtnTxtActive: { color: '#00FF9C', fontWeight: '800' },
  infoBox: {
    backgroundColor: 'rgba(0,255,156,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,156,0.15)',
    borderRadius: 14,
    padding: 18,
    marginBottom: 28,
    gap: 6,
  },
  infoTitle: {
    color: '#00FF9C',
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoItem: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
  nextBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  nextBtnText: { color: '#0A0A0F', fontWeight: '800', fontSize: 14, letterSpacing: 1 },
  // Capture screen
  captureSection: { flex: 1, alignItems: 'center', paddingTop: 8 },
  photoCounter: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  photoDot: { width: 32, height: 4, borderRadius: 2 },
  captureInstruction: {
    color: '#00FF9C',
    fontSize: 13,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 20,
  },
  cameraBox: {
    width: FRAME, height: FRAME,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#00FF9C', zIndex: 10 },
  cornerTL: { top: 12, left: 12, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 12, right: 12, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 12, left: 12, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 12, right: 12, borderBottomWidth: 3, borderRightWidth: 3 },
  faceGuide: {
    position: 'absolute',
    width: FRAME * 0.6, height: FRAME * 0.75,
    borderRadius: FRAME * 0.3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    top: FRAME * 0.1,
  },
  captureBtn: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    marginTop: 28,
  },
  captureBtnInner: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#FFFFFF' },
  loadingBox: { marginTop: 28, alignItems: 'center' },
  loadingText: { color: '#00FF9C', fontSize: 12, letterSpacing: 3 },
  // Done screen
  doneCard: {
    flex: 1, margin: 24, marginTop: 80,
    borderRadius: 24, borderWidth: 1,
    borderColor: 'rgba(0,255,156,0.3)',
    padding: 32, alignItems: 'center',
    justifyContent: 'center', gap: 10,
    backgroundColor: 'rgba(0,255,156,0.03)',
  },
  doneIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(0,255,156,0.1)',
    borderWidth: 1, borderColor: '#00FF9C',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  doneIcon: { fontSize: 36, color: '#00FF9C' },
  doneTitle: { fontSize: 32, fontWeight: '900', color: '#00FF9C', letterSpacing: 4 },
  doneName: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', letterSpacing: 1 },
  doneId: { color: 'rgba(255,255,255,0.35)', fontSize: 13, letterSpacing: 2 },
  doneDivider: { width: 40, height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 8 },
  doneMsg: { color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  doneBtn: {
    backgroundColor: '#FFFFFF', borderRadius: 12,
    paddingVertical: 16, paddingHorizontal: 32, marginTop: 16,
  },
  doneBtnText: { color: '#0A0A0F', fontWeight: '800', fontSize: 13, letterSpacing: 1 },
});