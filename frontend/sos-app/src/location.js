import * as Location from 'expo-location';

/**
 * Capture high-precision GPS coordinates for emergency alerts
 * Django expects 6 decimal places (max_digits=9, decimal_places=6)
 */
export async function getPosition() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission was denied. Please allow location access to trigger or respond to emergencies.');
    }

    // Attempt fast high-accuracy location first
    let location = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 7000)),
    ]).catch(async () => {
      // Fallback to last known position or balanced accuracy
      const last = await Location.getLastKnownPositionAsync();
      if (last) return last;
      return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    });

    if (!location || !location.coords) {
      throw new Error('Unable to retrieve GPS coordinates from device.');
    }

    const { latitude, longitude } = location.coords;
    return {
      latitude: Number(latitude).toFixed(6),
      longitude: Number(longitude).toFixed(6),
    };
  } catch (error) {
    console.warn('GPS location retrieval error:', error.message);
    throw error;
  }
}