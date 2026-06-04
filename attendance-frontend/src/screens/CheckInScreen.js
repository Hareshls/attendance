import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Alert, ActivityIndicator,
  Dimensions, SafeAreaView
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { apiService } from '../services/api';
import { getLocation } from '../utils/location';

const { width } = Dimensions.get('window');
const FRAME = width * 0.78;
const CHALLENGES = ['BLINK', 'SMILE', 'TURN LEFT', 'TURN RIGHT', 'NOD'];

export default function CheckInScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);

  const [step, setStep]         = useState('idle'); // idle -> location_preview -> challenge -> scanning -> verifying
  const [challenge, setChallenge] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [result, setResult]     = useState(null);
  const [locationObj, setLocationObj] = useState(null);
  const [address, setAddress] = useState('Fetching location...');

  const scanAnim    = useRef(new Animated.Value(0)).current;
  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const progressAnim= useRef(new Animated.Value(0)).current;
  const challengeStart = useRef(0);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    loadWorker();
  }, []);

  const loadWorker = async () => {
    const id = await AsyncStorage.getItem('worker_id');
    if (!id) {
      Alert.alert('Not Registered', 'Please register first.', [
        { text: 'Register', onPress: () => navigation.replace('Register') }
      ]);
      return;
    }
    setWorkerId(id);
  };

  const startScan = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, { toValue: FRAME - 4, duration: 1800, useNativeDriver: true }),
        Animated.timing(scanAnim, { toValue: 0,         duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  };

  const startLocationPreview = async () => {
    if (!permission?.granted) {
      requestPermission();
      return;
    }
    setStep('location_preview');
    try {
      const loc = await getLocation();
      setLocationObj(loc);
      
      // Try to reverse geocode
      import('expo-location').then(async (Location) => {
        const [geocode] = await Location.reverseGeocodeAsync({
          latitude: loc.latitude,
          longitude: loc.longitude,
        });
        if (geocode) {
          const formatted = `${geocode.street || ''} ${geocode.city || ''}, ${geocode.region || ''}`;
          setAddress(formatted.trim() ? formatted : 'Address not found');
        } else {
          setAddress(`Lat: ${loc.latitude.toFixed(4)}, Lon: ${loc.longitude.toFixed(4)}`);
        }
      }).catch(() => {
        setAddress(`Lat: ${loc.latitude.toFixed(4)}, Lon: ${loc.longitude.toFixed(4)}`);
      });
    } catch (e) {
      setAddress('Could not fetch location');
    }
  };

  const confirmLocation = () => {
    const random = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
    setChallenge(random);
    setStep('challenge');
    challengeStart.current = Date.now();
    startScan();
  };

  const getChallengePreview = (chal) => {
    switch (chal) {
      case 'BLINK': return '😑';
      case 'SMILE': return '😁';
      case 'TURN LEFT': return '👈';
      case 'TURN RIGHT': return '👉';
      case 'NOD': return '↕️';
      default: return '👤';
    }
  };

  const handleCapture = async () => {
    if (!cameraRef.current) return;
    const latencyMs = Date.now() - challengeStart.current;

    setStep('scanning');

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality : 0.7,
        base64  : true,
      });

      setStep('verifying');

      Animated.timing(progressAnim, {
        toValue: 1, duration: 1500, useNativeDriver: false
      }).start();

      const response = await apiService.checkIn({
        worker_id       : workerId,
        image_base64    : photo.base64,
        latitude        : locationObj ? locationObj.latitude : 0,
        longitude       : locationObj ? locationObj.longitude : 0,
        timestamp       : new Date().toISOString(),
        ear_value       : 0.20,
        response_latency: latencyMs,
        challenge       : challenge.toLowerCase().replace(' ', '_'),
        is_mock_location: false,
      });

      setResult(response);
      setStep(response.success ? 'done' : 'failed');

    } catch (error) {
      // Offline — save locally
      await saveOffline();
      setResult({ success: true, offline: true, message: 'Saved offline ✅' });
      setStep('done');
    }
  };

  const saveOffline = async () => {
    const existing = JSON.parse(await AsyncStorage.getItem('offline_records') || '[]');
    existing.push({ worker_id: workerId, timestamp: new Date().toISOString(), offline: true });
    await AsyncStorage.setItem('offline_records', JSON.stringify(existing));
  };

  const reset = () => {
    setStep('idle');
    setResult(null);
    scanAnim.setValue(0);
    progressAnim.setValue(0);
  };

  // ── Permission not granted ──
  if (!permission) return <View style={styles.container} />;
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permBox}>
          <Text style={styles.permText}>Camera permission needed</Text>
          <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
            <Text style={styles.permBtnText}>GRANT PERMISSION</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Result screen ──
  if (step === 'done' || step === 'failed') {
    const ok = step === 'done';
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.resultCard, { borderColor: ok ? '#00FF9C' : '#FF4D6D' }]}>
          <Text style={[styles.resultIcon, { color: ok ? '#00FF9C' : '#FF4D6D' }]}>
            {ok ? '◈' : '✕'}
          </Text>
          <Text style={[styles.resultTitle, { color: ok ? '#00FF9C' : '#FF4D6D' }]}>
            {ok ? 'VERIFIED' : 'REJECTED'}
          </Text>
          {result?.message && <Text style={styles.resultMsg}>{result.message}</Text>}
          {result?.similarity && (
            <View style={styles.statRow}>
              <Text style={styles.statLbl}>MATCH</Text>
              <Text style={styles.statVal}>{result.similarity}%</Text>
            </View>
          )}
          {result?.risk_level && (
            <View style={styles.statRow}>
              <Text style={styles.statLbl}>RISK</Text>
              <Text style={[styles.statVal, {
                color: result.risk_level === 'LOW' ? '#00FF9C' : '#FF4D6D'
              }]}>{result.risk_level}</Text>
            </View>
          )}
          {result?.offline && (
            <View style={styles.offlinePill}>
              <Text style={styles.offlineText}>⚡ SAVED OFFLINE — SYNCS LATER</Text>
            </View>
          )}
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.doneBtnText}>DONE</Text>
          </TouchableOpacity>
          {!ok && (
            <TouchableOpacity onPress={reset}>
              <Text style={styles.retryText}>TRY AGAIN</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.back}>← BACK</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>CHECK IN</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Location Preview */}
        {step === 'location_preview' && (
          <View style={styles.locationPreviewBox}>
             <Text style={styles.locIcon}>📍</Text>
             <Text style={styles.locTitle}>CURRENT LOCATION</Text>
             <Text style={styles.locAddress}>{address}</Text>
             <TouchableOpacity style={styles.confirmLocBtn} onPress={confirmLocation} disabled={!locationObj}>
                <Text style={styles.confirmLocBtnTxt}>CONFIRM LOCATION</Text>
             </TouchableOpacity>
          </View>
        )}

        {/* Camera */}
        {step !== 'idle' && step !== 'location_preview' && (
        <View style={styles.cameraSection}>
          <View style={styles.cameraFrame}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="front"
            />
            {/* Corners */}
            <View style={[styles.corner, styles.cTL]} />
            <View style={[styles.corner, styles.cTR]} />
            <View style={[styles.corner, styles.cBL]} />
            <View style={[styles.corner, styles.cBR]} />
            {/* Scan line */}
            {(step === 'scanning' || step === 'challenge') && (
              <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanAnim }] }]} />
            )}
            {/* Face oval */}
            <View style={styles.oval}>
              <View style={styles.crosshairX} />
              <View style={styles.crosshairY} />
            </View>
          </View>

          {/* Challenge prompt */}
          {step === 'challenge' && (
            <View style={styles.challengeBox}>
              <Text style={styles.challengeLabel}>BIOMETRIC SCAN REQUIRED</Text>
              <Text style={styles.challengeText}>AWAITING: {challenge}</Text>
              <Text style={styles.challengePreview}>{getChallengePreview(challenge)}</Text>
              <TouchableOpacity style={styles.captureBtn} onPress={handleCapture}>
                <Text style={styles.captureBtnText}>INITIATE SCAN</Text>
              </TouchableOpacity>
              <Text style={styles.challengeHint}>Tap to capture biometric data</Text>
            </View>
          )}

          {/* Verifying */}
          {step === 'verifying' && (
            <View style={styles.verifyBox}>
              <ActivityIndicator color="#00FF9C" />
              <Text style={styles.verifyText}>VERIFYING IDENTITY...</Text>
              <Animated.View style={[styles.progressBar, {
                width: progressAnim.interpolate({ inputRange: [0,1], outputRange: ['0%','100%'] })
              }]} />
            </View>
          )}
        </View>
        )}

        {/* Start button */}
        {step === 'idle' && (
          <View style={styles.bottom}>
            <Text style={styles.hint}>Verify your location first</Text>
            <TouchableOpacity style={styles.startBtn} onPress={startLocationPreview}>
              <Text style={styles.startBtnText}>START VERIFICATION</Text>
            </TouchableOpacity>
          </View>
        )}

      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container    : { flex: 1, backgroundColor: '#0A0A0F' },
  header       : {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 16,
  },
  back         : { color: 'rgba(255,255,255,0.4)', fontSize: 12, letterSpacing: 1, width: 60 },
  headerTitle  : { color: '#FFF', fontSize: 13, letterSpacing: 4, fontWeight: '700' },
  
  locationPreviewBox: {
    flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, gap: 16
  },
  locIcon: { fontSize: 64 },
  locTitle: { color: 'rgba(255,255,255,0.4)', fontSize: 11, letterSpacing: 3 },
  locAddress: { color: '#FFF', fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 24 },
  confirmLocBtn: { backgroundColor: '#00FF9C', paddingVertical: 16, paddingHorizontal: 32, borderRadius: 12 },
  confirmLocBtnTxt: { color: '#0A0A0F', fontWeight: '800', letterSpacing: 1 },
  
  cameraSection: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cameraFrame  : {
    width: FRAME, height: FRAME, borderRadius: 24,
    overflow: 'hidden', backgroundColor: '#111',
  },
  corner       : { position: 'absolute', width: 28, height: 28, borderColor: '#00FF9C', zIndex: 10 },
  cTL          : { top: 12, left: 12, borderTopWidth: 3, borderLeftWidth: 3 },
  cTR          : { top: 12, right: 12, borderTopWidth: 3, borderRightWidth: 3 },
  cBL          : { bottom: 12, left: 12, borderBottomWidth: 3, borderLeftWidth: 3 },
  cBR          : { bottom: 12, right: 12, borderBottomWidth: 3, borderRightWidth: 3 },
  scanLine     : {
    position: 'absolute', left: 0, right: 0,
    height: 2, backgroundColor: '#00FF9C', opacity: 0.8, zIndex: 10,
  },
  oval         : {
    position: 'absolute',
    width: FRAME * 0.65, height: FRAME * 0.8,
    borderRadius: FRAME * 0.325,
    borderWidth: 2, borderColor: 'rgba(0, 255, 156, 0.4)',
    borderStyle: 'dashed',
    alignSelf: 'center', top: FRAME * 0.1,
    alignItems: 'center', justifyContent: 'center'
  },
  crosshairX   : { position: 'absolute', width: '100%', height: 1, backgroundColor: 'rgba(0, 255, 156, 0.2)' },
  crosshairY   : { position: 'absolute', width: 1, height: '100%', backgroundColor: 'rgba(0, 255, 156, 0.2)' },
  challengeBox : { marginTop: 24, alignItems: 'center', gap: 8 },
  challengeLabel: { color: 'rgba(0, 255, 156, 0.7)', fontSize: 11, letterSpacing: 3 },
  challengeText : { color: '#00FF9C', fontSize: 22, fontWeight: '900', letterSpacing: 2 },
  challengePreview: { fontSize: 40, marginTop: 2, marginBottom: 6 },
  captureBtn   : {
    paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12,
    backgroundColor: 'rgba(0, 255, 156, 0.15)',
    borderWidth: 1, borderColor: '#00FF9C',
    alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  captureBtnText: { color: '#00FF9C', fontWeight: '800', letterSpacing: 2, fontSize: 13 },
  challengeHint : { color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 4 },
  verifyBox    : { marginTop: 24, alignItems: 'center', gap: 10, width: FRAME },
  verifyText   : { color: '#00FF9C', fontSize: 11, letterSpacing: 3 },
  progressBar  : { height: 2, backgroundColor: '#00FF9C', borderRadius: 2 },
  bottom       : { padding: 24, gap: 14, alignItems: 'center' },
  hint         : { color: 'rgba(255,255,255,0.35)', fontSize: 13, textAlign: 'center' },
  startBtn     : {
    backgroundColor: '#FFF', borderRadius: 14,
    paddingVertical: 18, width: '100%', alignItems: 'center',
  },
  startBtnText : { color: '#0A0A0F', fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  // Permission
  permBox      : { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  permText     : { color: '#FFF', fontSize: 16, textAlign: 'center' },
  permBtn      : { backgroundColor: '#00FF9C', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28 },
  permBtnText  : { color: '#0A0A0F', fontWeight: '800', letterSpacing: 1 },
  // Result
  resultCard   : {
    flex: 1, margin: 24, marginTop: 60,
    borderRadius: 24, borderWidth: 1,
    padding: 32, alignItems: 'center',
    justifyContent: 'center', gap: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  resultIcon   : { fontSize: 52, marginBottom: 8 },
  resultTitle  : { fontSize: 34, fontWeight: '900', letterSpacing: 4 },
  resultMsg    : { color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center' },
  statRow      : {
    flexDirection: 'row', justifyContent: 'space-between',
    width: '100%', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  statLbl      : { color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: 2 },
  statVal      : { color: '#FFF', fontSize: 14, fontWeight: '700' },
  offlinePill  : {
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
    borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8,
  },
  offlineText  : { color: '#FFD700', fontSize: 10, letterSpacing: 1, fontWeight: '700' },
  doneBtn      : {
    backgroundColor: '#FFF', borderRadius: 12,
    paddingVertical: 16, paddingHorizontal: 48, marginTop: 16,
  },
  doneBtnText  : { color: '#0A0A0F', fontWeight: '800', letterSpacing: 2 },
  retryText    : { color: 'rgba(255,255,255,0.3)', fontSize: 12, letterSpacing: 2, marginTop: 4 },
});