import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, Image, ActivityIndicator, SectionList, Alert } from 'react-native';
import { apiService } from '../services/api';
import { DatabaseService } from '../services/DatabaseService';
import { Web3Service } from '../services/Web3Service';
import { ethers } from 'ethers';

export default function SupervisorDashboard({ navigation }) {
  const [data, setData] = useState({ attendance: [], failed_attempts: [] });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expandedDept, setExpandedDept] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiService.getSupervisorData();
      
      // Also fetch local offline attendance that hasn't synced
      const localAttendance = await DatabaseService.getUnsyncedAttendance();
      if (localAttendance && localAttendance.length > 0) {
         res.attendance = [...localAttendance, ...res.attendance];
      }
      
      setData(res);
    } catch (e) {
      console.log('Error fetching dashboard data:', e);
    }
    setLoading(false);
  };

  const syncOfflineData = async () => {
    setSyncing(true);
    try {
      const unsynced = await DatabaseService.getUnsyncedAttendance();
      if (!unsynced || unsynced.length === 0) {
        Alert.alert('Sync', 'No offline records to sync.');
        setSyncing(false);
        return;
      }
      
      console.log('Syncing records to Web3...', unsynced.length);

      // 1. Generate Cryptographic Hash Block for the batch
      // In a production Web3 app, we'd build a proper Merkle Tree. 
      // For now, we hash the stringified batch to create a single root hash using ethers.
      const batchString = JSON.stringify(unsynced);
      const batchHash = ethers.id(batchString); // Pure JS Keccak256 hash

      // 2. Mint the batch hash to the Polygon Blockchain via Web3Service
      const supervisorId = 'SUP-001'; // hardcoded for demo
      const web3Result = await Web3Service.mintBatchToBlockchain(batchHash, supervisorId, unsynced.length);

      if (!web3Result.success) {
        throw new Error(web3Result.message);
      }
      
      // 3. Mark locally as synced
      const ids = unsynced.map(r => r.id);
      await DatabaseService.markSynced(ids);
      
      Alert.alert(
        'Web3 Sync Complete', 
        `Minted ${unsynced.length} records to Polygon Blockchain!\n\nTxHash: ${web3Result.transactionHash}\n\nThis attendance block is now mathematically tamper-proof.`
      );
      fetchData(); // Refresh UI
    } catch (e) {
      console.error('Web3 Sync failed', e);
      Alert.alert('Sync Failed', 'Could not sync records to Blockchain: ' + e.message);
    }
    setSyncing(false);
  };

  // Group data: Department -> Date -> Member Records
  const processData = () => {
    const allRecords = [
      ...data.attendance.map(r => ({ ...r, type: 'success' })),
      ...data.failed_attempts.map(r => ({ ...r, type: 'failed' }))
    ];
    
    // Sort by timestamp descending
    allRecords.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const grouped = {};
    const alerts = [];
    allRecords.forEach(rec => {
      if (rec.type === 'failed') {
        alerts.push(rec);
      } else {
        const dept = rec.department || 'Unassigned';
        const date = new Date(rec.timestamp).toLocaleDateString();
        if (!grouped[dept]) grouped[dept] = {};
        if (!grouped[dept][date]) grouped[dept][date] = [];
        grouped[dept][date].push(rec);
      }
    });

    const sections = [];
    if (alerts.length > 0) {
      sections.push({
        department: '⚠️ CRITICAL ALERTS',
        dates: [{ date: 'SPOOF ATTEMPTS', records: alerts }]
      });
    }

    Object.keys(grouped).forEach(dept => {
      sections.push({
        department: dept,
        dates: Object.keys(grouped[dept]).map(date => ({
          date,
          records: grouped[dept][date]
        }))
      });
    });

    return sections;
  };

  const renderRecord = (item) => {
    const isFailed = item.type === 'failed';
    const isRisky = item.risk_level === 'HIGH';
    const hasWarning = isFailed || isRisky;

    return (
      <View key={item.id} style={[styles.card, hasWarning && styles.cardWarning]}>
        <View style={styles.cardHeader}>
          <Text style={styles.workerName}>{item.worker_name || item.worker_id}</Text>
          <Text style={[styles.badge, hasWarning ? styles.badgeRed : styles.badgeGreen]}>
            {isFailed ? 'SPOOF FAILED' : isRisky ? 'HIGH RISK' : 'VERIFIED'}
          </Text>
        </View>
        
        <Text style={styles.time}>{new Date(item.timestamp).toLocaleTimeString()}</Text>

        <View style={styles.row}>
          {item.image_base64 ? (
             <Image source={{ uri: `data:image/jpeg;base64,${item.image_base64}` }} style={styles.photo} />
          ) : (
             <View style={[styles.photo, styles.noPhoto]}><Text style={styles.noPhotoTxt}>No Photo</Text></View>
          )}
          <View style={styles.details}>
            {item.role && <Text style={styles.detailTxt}>Role: {item.role}</Text>}
            {isFailed && <Text style={styles.failReason}>Reason: {item.reason}</Text>}
            {!isFailed && (
              <>
                <Text style={styles.detailTxt}>
                  Match: <Text style={{ color: item.similarity >= 60 ? '#00FF9C' : '#FF4D6D', fontWeight: 'bold' }}>{item.similarity}%</Text>
                </Text>
                <Text style={styles.detailTxt}>
                  Trust: <Text style={{ color: item.trust_score >= 70 ? '#00FF9C' : '#FF4D6D', fontWeight: 'bold' }}>{item.trust_score}%</Text>
                </Text>
              </>
            )}
            <Text style={[styles.detailTxt, hasWarning && { color: '#FF4D6D', fontWeight: 'bold' }]}>
              Lat: {item.latitude?.toFixed(4)}, Lon: {item.longitude?.toFixed(4)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderDepartment = ({ item }) => {
    const isExpanded = expandedDept === item.department;
    return (
      <View style={styles.deptContainer}>
        <TouchableOpacity style={styles.deptHeader} onPress={() => setExpandedDept(isExpanded ? null : item.department)}>
          <Text style={styles.deptTitle}>{item.department.toUpperCase()}</Text>
          <Text style={styles.deptIcon}>{isExpanded ? '▼' : '▶'}</Text>
        </TouchableOpacity>
        
        {isExpanded && item.dates.map((dateObj, i) => (
          <View key={i} style={styles.dateGroup}>
            <Text style={styles.dateTitle}>{dateObj.date}</Text>
            {dateObj.records.map(rec => renderRecord(rec))}
          </View>
        ))}
      </View>
    );
  };

  const groupedData = processData();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>← LOGOUT</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SUPERVISOR</Text>
        <TouchableOpacity onPress={fetchData}>
          <Text style={styles.refresh}>↻</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.enrollBtn} onPress={() => navigation.navigate('SupervisorRegister')}>
        <Text style={styles.enrollBtnTxt}>+ ENROLL NEW WORKER</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.syncBtn} onPress={syncOfflineData} disabled={syncing}>
        <Text style={styles.syncBtnTxt}>{syncing ? 'SYNCING...' : '☁️ SYNC OFFLINE DATA'}</Text>
      </TouchableOpacity>

      {loading ? (
        <View style={styles.loader}><ActivityIndicator color="#00FF9C" size="large" /></View>
      ) : (
        <FlatList
          data={groupedData}
          keyExtractor={item => item.department}
          renderItem={renderDepartment}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No departments found.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 24, alignItems: 'center' },
  back: { color: 'rgba(255,255,255,0.4)', fontSize: 12, letterSpacing: 1 },
  headerTitle: { color: '#FFF', fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  refresh: { color: '#00FF9C', fontSize: 20 },
  enrollBtn: { marginHorizontal: 24, marginBottom: 8, backgroundColor: 'rgba(0,255,156,0.1)', borderWidth: 1, borderColor: '#00FF9C', padding: 16, borderRadius: 12, alignItems: 'center' },
  enrollBtnTxt: { color: '#00FF9C', fontWeight: '800', letterSpacing: 1 },
  syncBtn: { marginHorizontal: 24, marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', padding: 14, borderRadius: 12, alignItems: 'center' },
  syncBtnTxt: { color: '#FFF', fontWeight: '700', letterSpacing: 1, fontSize: 12 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 24, paddingBottom: 40, gap: 16 },
  
  deptContainer: { marginBottom: 8 },
  deptHeader: { backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between' },
  deptTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  deptIcon: { color: 'rgba(255,255,255,0.3)', fontSize: 14 },
  
  dateGroup: { marginTop: 12, marginLeft: 12, paddingLeft: 12, borderLeftWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  dateTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700', letterSpacing: 2, marginBottom: 12 },
  
  card: { backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 12 },
  cardWarning: { borderColor: 'rgba(255,77,109,0.5)', backgroundColor: 'rgba(255,77,109,0.05)' },
  
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  workerName: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  badge: { fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, overflow: 'hidden' },
  badgeGreen: { backgroundColor: 'rgba(0,255,156,0.1)', color: '#00FF9C' },
  badgeRed: { backgroundColor: 'rgba(255,77,109,0.2)', color: '#FF4D6D' },
  
  time: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 16 },
  photo: { width: 70, height: 70, borderRadius: 8, backgroundColor: '#222' },
  noPhoto: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  noPhotoTxt: { color: 'rgba(255,255,255,0.3)', fontSize: 10 },
  details: { flex: 1, justifyContent: 'center', gap: 4 },
  detailTxt: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
  failReason: { color: '#FF4D6D', fontSize: 12, fontWeight: '700', marginBottom: 2 },
  empty: { color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginTop: 40 }
});
