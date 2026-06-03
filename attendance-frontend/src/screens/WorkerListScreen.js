import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import api from '../services/api';

export default function WorkerListScreen() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/workers');
      setWorkers(response.data.workers || []);
    } catch (error) {
      const msg = error.response?.data?.detail || error.message;
      Alert.alert("Error", "Failed to fetch workers: " + msg);
    } finally {
      setLoading(false);
    }
  };

  const deleteWorker = async (workerId) => {
    Alert.alert("Confirm", `Are you sure you want to delete ${workerId}?`, [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", 
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/workers/${workerId}`);
            fetchWorkers();
          } catch (error) {
            Alert.alert("Error", "Failed to delete worker");
          }
        }
      }
    ]);
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.infoContainer}>
        <Text style={styles.nameText}>{item.name}</Text>
        <Text style={styles.idText}>ID: {item.worker_id}</Text>
      </View>
      <TouchableOpacity style={styles.deleteButton} onPress={() => deleteWorker(item.worker_id)}>
        <Text style={styles.deleteText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Registered Workers</Text>
      
      {loading ? (
        <ActivityIndicator size="large" color="#e94560" style={{ marginTop: 50 }} />
      ) : workers.length === 0 ? (
        <Text style={styles.emptyText}>No workers registered yet.</Text>
      ) : (
        <FlatList
          data={workers}
          keyExtractor={(item) => item.worker_id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 20 }}
          onRefresh={fetchWorkers}
          refreshing={loading}
        />
      )}
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
  card: {
    backgroundColor: '#0f3460',
    padding: 18,
    borderRadius: 12,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
  },
  nameText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  idText: {
    color: '#a2a8d3',
    fontSize: 14,
  },
  emptyText: {
    color: '#a2a8d3',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
  deleteButton: {
    backgroundColor: '#rgba(233, 69, 96, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e94560',
  },
  deleteText: {
    color: '#e94560',
    fontWeight: 'bold',
  }
});
