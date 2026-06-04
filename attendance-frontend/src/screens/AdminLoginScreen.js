import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { apiService } from '../services/api';

export default function AdminLoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please enter username and password');
      return;
    }
    setLoading(true);
    try {
      const res = await apiService.adminLogin(username, password);
      if (res.success) {
        navigation.replace('SupervisorDashboard');
      } else {
        Alert.alert('Login Failed', res.message);
      }
    } catch (e) {
      Alert.alert('Error', 'Network error');
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← BACK</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🛡️</Text>
        </View>
        <Text style={styles.title}>SUPERVISOR LOGIN</Text>
        <Text style={styles.subtitle}>Secure access for administrators</Text>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>USERNAME</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="admin"
            placeholderTextColor="rgba(255,255,255,0.2)"
            autoCapitalize="none"
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: { padding: 24 },
  back: { color: 'rgba(255,255,255,0.4)', fontSize: 12, letterSpacing: 1 },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', paddingBottom: 100 },
  iconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(0,255,156,0.1)',
    borderWidth: 1, borderColor: '#00FF9C',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24, alignSelf: 'center'
  },
  icon: { fontSize: 36 },
  title: { color: '#FFF', fontSize: 24, fontWeight: '900', letterSpacing: 2, textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', marginBottom: 40 },
  inputGroup: { marginBottom: 20 },
  label: { color: 'rgba(255,255,255,0.3)', fontSize: 10, letterSpacing: 3, marginBottom: 8 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12, paddingHorizontal: 18, paddingVertical: 16,
    color: '#FFF', fontSize: 16
  },
  btn: {
    backgroundColor: '#00FF9C', borderRadius: 14,
    paddingVertical: 18, alignItems: 'center', marginTop: 12
  },
  btnText: { color: '#0A0A0F', fontWeight: '800', letterSpacing: 2 }
});
