import * as Location from 'expo-location';

export const getLocation = async () => {
  try {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { latitude: 0, longitude: 0, isMock: false };
    }

    let location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High
    });
    
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
      isMock: location.mocked || false,
    };
  } catch (error) {
    return { latitude: 0, longitude: 0, isMock: false };
  }
};