import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';
import { DatabaseService } from '../services/DatabaseService';

export default function LoginScreen({ navigation }) {
  const [step, setStep] = useState('form');
  const [workerId, setWorkerId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!workerId.trim()) {
      Alert.alert('Error', 'Please enter your Worker ID');
      return;
    }
    
    setLoading(true);
    try {
      const res = await apiService.workerLogin(workerId.trim(), ""); // Password is empty for now

      if (res.success) {
        // Save worker to local SQLite so offline check-in works on this device
        if (res.embedding) {
          const worker = {
            worker_id   : res.worker_id,
            worker_name : res.name,
            dob         : '',
            role        : res.role,
            department  : res.department,
            image_base64: "", // No image captured at login anymore
            embedding   : res.embedding,
          };
          await DatabaseService.saveWorkerLocally(worker);
        }

        await AsyncStorage.setItem('worker_id', res.worker_id);
        await AsyncStorage.setItem('worker_name', res.name);
        navigation.replace('WorkerDashboard');
      } else {
        Alert.alert('Login Failed', res.message);
      }
    } catch (e) {
      console.error("Login validation failed due to network error:", e);
      try {
        const localWorker = await DatabaseService.getWorkerLocally(workerId.trim());
        if (localWorker) {
          await AsyncStorage.setItem('worker_id', localWorker.worker_id);
          await AsyncStorage.setItem('worker_name', localWorker.name);
          Alert.alert('Offline Mode', `Logged in offline as ${localWorker.name} ✅`);
          navigation.replace('WorkerDashboard');
        } else {
          Alert.alert(
            'Offline Login Failed',
            'Worker ID not found in local database. An online connection is required for your first login on this device.'
          );
        }
      } catch (localError) {
        console.error("Local database fallback failed:", localError);
        Alert.alert('Error', 'Network error. Could not verify login.');
      }
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>FIELD GUARD</Text>
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
          <Text style={styles.label}>QUICK LOGIN</Text>
          <Text style={{color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 12}}>
            Enter your Worker ID to access your dashboard. Facial verification will occur during Check-in.
          </Text>
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#0A0A0F" /> : <Text style={styles.btnText}>LOGIN TO DASHBOARD</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('AdminLogin')} style={styles.adminWrap}>
          <Text style={styles.adminTxt}>🛡️ SUPERVISOR LOGIN</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  adminWrap: { paddingVertical: 16, marginTop: 24, alignItems: 'center' },
  adminTxt: { color: 'rgba(255,255,255,0.45)', fontSize: 12, letterSpacing: 2 },
  
});
