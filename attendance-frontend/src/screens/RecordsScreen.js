import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Animated, RefreshControl
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '../services/api';

export default function RecordsScreen({ navigation }) {
  const [records, setRecords]     = useState([]);
  const [offline, setOffline]     = useState([]);
  const [syncing, setSyncing]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    loadAll();
  }, []);

  const loadAll = async () => {
    // Load offline records
    const offlineRaw = await AsyncStorage.getItem('offline_records');
    setOffline(JSON.parse(offlineRaw || '[]'));

    // Try to fetch from server
    try {
      const res = await apiService.getUnsynced();
      setRecords(res.records || []);
    } catch {}
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      const res = await apiService.getUnsynced();
      if (res.records?.length > 0) {
        const ids = res.records.map(r => r.id);
        await apiService.markSynced(ids);
        // Clear offline records
        await AsyncStorage.setItem('offline_records', '[]');
        setOffline([]);
        await loadAll();
      }
    } catch (e) {
      // Still offline
    }
    setSyncing(false);
  };

  const renderRecord = ({ item, index }) => (
    <Animated.View style={[
      styles.recordCard,
      item.offline && styles.recordCardOffline,
      { opacity: fadeAnim }
    ]}>
      <View style={styles.recordLeft}>
        <View style={[
          styles.riskDot,
          { backgroundColor: item.risk_level === 'LOW' ? '#00FF9C' : item.risk_level === 'MEDIUM' ? '#FFD700' : '#FF4D6D' }
        ]} />
        <View>
          <Text style={styles.recordName}>{item.worker_name || item.worker_id}</Text>
          <Text style={styles.recordTime}>
            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {'  '}
            {new Date(item.timestamp).toLocaleDateString()}
          </Text>
          {item.offline && <Text style={styles.offlineTag}>⚡ OFFLINE</Text>}
        </View>
      </View>
      <View style={styles.recordRight}>
        {item.similarity && (
          <Text style={styles.matchScore}>{item.similarity}%</Text>
        )}
        {item.risk_level && (
          <Text style={[styles.riskLabel, {
            color: item.risk_level === 'LOW' ? '#00FF9C' : '#FFD700'
          }]}>{item.risk_level}</Text>
        )}
        <Text style={styles.checkMark}>✓</Text>
      </View>
    </Animated.View>
  );

  const allRecords = [
    ...records,
    ...offline.map(o => ({ ...o, offline: true }))
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>RECORDS</Text>
        <TouchableOpacity onPress={syncNow} disabled={syncing}>
          <Text style={[styles.syncBtn, syncing && { opacity: 0.4 }]}>
            {syncing ? 'SYNCING...' : '↑ SYNC'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statNum}>{allRecords.length}</Text>
          <Text style={styles.statLbl}>TOTAL</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNum, { color: '#FFD700' }]}>{offline.length}</Text>
          <Text style={styles.statLbl}>OFFLINE</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNum, { color: '#00FF9C' }]}>
            {records.filter(r => r.risk_level === 'LOW').length}
          </Text>
          <Text style={styles.statLbl}>VERIFIED</Text>
        </View>
      </View>

      {/* List */}
      {allRecords.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>◫</Text>
          <Text style={styles.emptyText}>NO RECORDS YET</Text>
          <Text style={styles.emptySubtext}>Check in to see records here</Text>
        </View>
      ) : (
        <FlatList
          data={allRecords}
          keyExtractor={(_, i) => i.toString()}
          renderItem={renderRecord}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={loadAll}
              tintColor="#00FF9C"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56, paddingHorizontal: 24, paddingBottom: 16,
  },
  backBtn: { color: 'rgba(255,255,255,0.4)', fontSize: 12, letterSpacing: 1, width: 60 },
  headerTitle: { color: '#FFFFFF', fontSize: 13, letterSpacing: 4, fontWeight: '700' },
  syncBtn: { color: '#00FF9C', fontSize: 12, letterSpacing: 1, fontWeight: '700', width: 80, textAlign: 'right' },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 24, marginBottom: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 28, fontWeight: '900', color: '#FFFFFF' },
  statLbl: { fontSize: 9, letterSpacing: 2, color: 'rgba(255,255,255,0.3)', marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.08)' },
  listContent: { paddingHorizontal: 24, paddingBottom: 40, gap: 10 },
  recordCard: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  recordCardOffline: {
    borderColor: 'rgba(255,215,0,0.2)',
    backgroundColor: 'rgba(255,215,0,0.04)',
  },
  recordLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  riskDot: { width: 8, height: 8, borderRadius: 4 },
  recordName: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  recordTime: { color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2 },
  offlineTag: { color: '#FFD700', fontSize: 9, letterSpacing: 1, marginTop: 3, fontWeight: '700' },
  recordRight: { alignItems: 'flex-end', gap: 2 },
  matchScore: { color: '#00FF9C', fontSize: 16, fontWeight: '800' },
  riskLabel: { fontSize: 9, letterSpacing: 1, fontWeight: '700' },
  checkMark: { color: 'rgba(255,255,255,0.2)', fontSize: 16 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyIcon: { fontSize: 48, color: 'rgba(255,255,255,0.1)' },
  emptyText: { color: 'rgba(255,255,255,0.2)', fontSize: 14, letterSpacing: 3, fontWeight: '700' },
  emptySubtext: { color: 'rgba(255,255,255,0.15)', fontSize: 12 },
});