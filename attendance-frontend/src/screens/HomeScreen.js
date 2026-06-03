import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Attendance System</Text>
      <Text style={styles.subtitle}>Select an option below to continue</Text>

      <TouchableOpacity 
        style={styles.button} 
        onPress={() => navigation.navigate('CheckIn')}
      >
        <Text style={styles.buttonText}>Check In (Mark Attendance)</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, styles.secondaryButton]} 
        onPress={() => navigation.navigate('Register')}
      >
        <Text style={styles.buttonText}>Register New Worker</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={[styles.button, styles.tertiaryButton]} 
        onPress={() => navigation.navigate('WorkerList')}
      >
        <Text style={styles.buttonText}>View Registered Workers</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#16213e',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e94560',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#a2a8d3',
    marginBottom: 40,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#0f3460',
    width: '100%',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.3)',
    elevation: 5,
  },
  secondaryButton: {
    backgroundColor: '#e94560',
  },
  tertiaryButton: {
    backgroundColor: '#53354a',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
