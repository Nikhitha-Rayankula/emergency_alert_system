/**
 * OpenStreetMap Routing Service
 * Uses public OSRM (Open Source Routing Machine) API
 * 100% Google-Free, OpenStreetMap-based navigation & distance calculation
 */

// Haversine formula for straight-line distance in kilometers
export function haversineKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistance(metersOrKm, isKm = false) {
  const km = isKm ? metersOrKm : metersOrKm / 1000;
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '1 min';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'}`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours} hr ${remMins} min`;
}

/**
 * Fetch driving/walking road route between two OpenStreetMap coordinates
 * @param {number} startLat - Responder Latitude
 * @param {number} startLng - Responder Longitude
 * @param {number} endLat - Emergency Latitude
 * @param {number} endLng - Emergency Longitude
 */
export async function getOSRMRoute(startLat, startLng, endLat, endLng) {
  if (!startLat || !startLng || !endLat || !endLng) return null;

  try {
    // OSRM expects coordinates in {longitude},{latitude} order
    const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
    const response = await fetch(url, { headers: { 'User-Agent': 'CommunityEmergencyResponse/1.0' } });
    if (!response.ok) {
      throw new Error(`OSRM status: ${response.status}`);
    }

    const data = await response.json();
    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const route = data.routes[0];
      return {
        success: true,
        distanceMeters: route.distance,
        distanceText: formatDistance(route.distance),
        durationSeconds: route.duration,
        durationText: formatDuration(route.duration),
        coordinates: route.geometry.coordinates, // Array of [lng, lat]
        steps: route.legs?.[0]?.steps || [],
      };
    }
  } catch (error) {
    console.log('OSRM routing fallback to direct line:', error.message);
  }

  // Fallback if OSRM is unreachable or network is restricted
  const straightKm = haversineKm(startLat, startLng, endLat, endLng);
  return {
    success: false,
    distanceMeters: Math.round(straightKm * 1000),
    distanceText: formatDistance(straightKm, true),
    durationSeconds: Math.round(straightKm * 120), // approx 30km/h
    durationText: formatDuration(Math.round(straightKm * 120)),
    coordinates: [
      [Number(startLng), Number(startLat)],
      [Number(endLng), Number(endLat)],
    ],
    steps: [],
  };
}
