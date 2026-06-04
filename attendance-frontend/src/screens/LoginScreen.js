import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';

export default function LoginScreen({ navigation }) {
  const [workerId, setWorkerId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!workerId.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter your Worker ID and Password');
      return;
    }
    setLoading(true);
    try {
      const res = await apiService.workerLogin(workerId.trim(), password.trim());
      if (res.success) {
        await AsyncStorage.setItem('worker_id', res.worker_id);
        await AsyncStorage.setItem('worker_name', res.name);
        navigation.replace('WorkerDashboard');
      } else {
        Alert.alert('Login Failed', res.message);
      }
    } catch (e) {
      // Offline fallback: check if we have it locally
      const localId = await AsyncStorage.getItem('worker_id');
      if (localId && localId === workerId.trim()) {
        navigation.replace('WorkerDashboard');
      } else {
        Alert.alert('Error', 'Network error. Could not verify Worker ID.');
      }
    }
    setLoading(false);
  };

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
          <Text style={styles.label}>PASSWORD</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="rgba(255,255,255,0.2)"
            secureTextEntry
          />
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#0A0A0F" /> : <Text style={styles.btnText}>LOGIN</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.linkWrap}>
          <Text style={styles.linkTxt}>New user? <Text style={{color: '#00FF9C'}}>Register here</Text></Text>
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
  btnText: { color: '#0A0A0F', fontWeight: '800', letterSpacing: 2 },
  linkWrap: { marginTop: 32, alignItems: 'center' },
  linkTxt: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  adminWrap: { padding: 24, alignItems: 'center' },
  adminTxt: { color: 'rgba(255,255,255,0.2)', fontSize: 11, letterSpacing: 2 }
});
