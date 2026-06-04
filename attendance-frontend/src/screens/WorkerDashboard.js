import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function WorkerDashboard({ navigation }) {
  const [name, setName] = useState('');
  const [workerId, setWorkerId] = useState('');

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const n = await AsyncStorage.getItem('worker_name');
    const i = await AsyncStorage.getItem('worker_id');
    if (n) setName(n);
    if (i) setWorkerId(i);
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: async () => {
        await AsyncStorage.removeItem('worker_id');
        await AsyncStorage.removeItem('worker_name');
        navigation.replace('Login');
      }}
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ width: 60 }} />
        <Text style={styles.headerTitle}>DASHBOARD</Text>
        <TouchableOpacity onPress={handleLogout} style={{ width: 60, alignItems: 'flex-end' }}>
          <Text style={styles.logoutTopTxt}>LOGOUT</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mainSection}>
        <Text style={styles.pageTitle}>WORKER{'\n'}DASHBOARD</Text>
        <View style={styles.pageTitleLine} />
        <Text style={styles.pageSubtitle}>
          Welcome back, {name || workerId}.
        </Text>

      <View style={styles.content}>
        <TouchableOpacity style={styles.btnMain} onPress={() => navigation.navigate('CheckIn')} activeOpacity={0.8}>
          <Text style={styles.btnMainTxt}>CHECK IN</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnSec} onPress={() => navigation.navigate('Records')} activeOpacity={0.8}>
          <Text style={styles.btnSecTxt}>VIEW PAST RECORDS</Text>
        </TouchableOpacity>
      </View>
      </View>
    </SafeAreaView>
  );
}

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
  headerTitle: { color: '#FFFFFF', fontSize: 13, letterSpacing: 4, fontWeight: '700' },
  logoutTopTxt: { color: 'rgba(255,77,109,0.8)', fontSize: 12, letterSpacing: 1, fontWeight: '700' },
  
  mainSection: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40, flex: 1 },
  pageTitle: { fontSize: 48, fontWeight: '900', color: '#FFFFFF', lineHeight: 50 },
  pageTitleLine: { width: 40, height: 3, backgroundColor: '#00FF9C', marginVertical: 12 },
  pageSubtitle: { color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 48 },

  content: { justifyContent: 'center', gap: 20 },
  
  btnMain: { 
    backgroundColor: '#FFF', borderRadius: 14, 
    paddingVertical: 18, alignItems: 'center', justifyContent: 'center',
  },
  btnMainTxt: { color: '#0A0A0F', fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  
  btnSec: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 14,
    paddingVertical: 18, backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center'
  },
  btnSecTxt: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 2 },
});
