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

export default function App() {
  return (
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
  );
}