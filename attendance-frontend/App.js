import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';

import HomeScreen from './src/screens/HomeScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import CheckInScreen from './src/screens/CheckInScreen';
import WorkerListScreen from './src/screens/WorkerListScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1a1a2e',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
          cardStyle: { backgroundColor: '#16213e' }
        }}
      >
        <Stack.Screen 
          name="Home" 
          component={HomeScreen} 
          options={{ title: 'Attendance System' }} 
        />
        <Stack.Screen 
          name="Register" 
          component={RegisterScreen} 
          options={{ title: 'Register Worker' }} 
        />
        <Stack.Screen 
          name="CheckIn" 
          component={CheckInScreen} 
          options={{ title: 'Check In' }} 
        />
        <Stack.Screen 
          name="WorkerList" 
          component={WorkerListScreen} 
          options={{ title: 'Registered Workers' }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
