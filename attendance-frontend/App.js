import 'react-native-get-random-values';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import LoginScreen    from './src/screens/LoginScreen';
import WorkerDashboard from './src/screens/WorkerDashboard';
import CheckInScreen  from './src/screens/CheckInScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import RecordsScreen  from './src/screens/RecordsScreen';
import AdminLoginScreen from './src/screens/AdminLoginScreen';
import SupervisorDashboard from './src/screens/SupervisorDashboard';
import SupervisorRegisterScreen from './src/screens/SupervisorRegisterScreen';

const Stack = createNativeStackNavigator();

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  useEffect(() => {
    // Hide the splash screen instantly after the app boots
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <SafeAreaProvider style={{ flex: 1 }}>
      <NavigationContainer>
      <StatusBar style="light" backgroundColor="#0A0A0F" />
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown  : false,
          animation    : 'slide_from_right',
          contentStyle : { backgroundColor: '#0A0A0F' },
        }}
      >
        <Stack.Screen name="Login"    component={LoginScreen}    />
        <Stack.Screen name="WorkerDashboard" component={WorkerDashboard} />
        <Stack.Screen name="CheckIn"  component={CheckInScreen}  />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Records"  component={RecordsScreen}  />
        <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
        <Stack.Screen name="SupervisorDashboard" component={SupervisorDashboard} />
        <Stack.Screen name="SupervisorRegister" component={SupervisorRegisterScreen} />
      </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}