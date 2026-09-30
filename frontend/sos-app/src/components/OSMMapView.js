import React, { useMemo, useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Text, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { C } from '../ui';

/**
 * OpenStreetMap Map Component powered by Leaflet
 * 100% Free OpenStreetMap & OSRM integration - No Google Maps API Key required!
 */
export default function OSMMapView({
  emergencyLocation,
  responderLocation,
  nearbyIncidents = [],
  routeCoordinates = [],
  height = 280,
  style,
  interactive = true,
  showRoute = true,
  distanceText,
  durationText,
}) {
  const webViewRef = useRef(null);

  // Generate Leaflet HTML dynamically based on props
  const htmlContent = useMemo(() => {
    const defaultCenter = emergencyLocation || responderLocation || { latitude: 12.9716, longitude: 77.5946 };
    const centerLat = Number(defaultCenter.latitude || 12.9716);
    const centerLng = Number(defaultCenter.longitude || 77.5946);

    const emerLat = emergencyLocation ? Number(emergencyLocation.latitude) : null;
    const emerLng = emergencyLocation ? Number(emergencyLocation.longitude) : null;
    const emerTitle = emergencyLocation?.title || 'Emergency Location';
    const emerCat = emergencyLocation?.category || 'Emergency';

    const respLat = responderLocation ? Number(responderLocation.latitude) : null;
    const respLng = responderLocation ? Number(responderLocation.longitude) : null;
    const respTitle = responderLocation?.title || 'Your Current Location';

    const cleanIncidents = nearbyIncidents.map((inc) => ({
      id: inc.id,
      lat: Number(inc.latitude),
      lng: Number(inc.longitude),
      title: inc.user ? `${inc.category?.toUpperCase()} - ${inc.user}` : inc.category || 'Incident',
      category: inc.category || 'other',
      distance: inc.distance_meters ? `${inc.distance_meters}m away` : '',
    }));

    // Convert GeoJSON route [lng, lat] to Leaflet [lat, lng]
    const leafletRoute = routeCoordinates.map((pt) => [Number(pt[1]), Number(pt[0])]);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body { height: 100%; width: 100%; margin: 0; padding: 0; background: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    #map { height: 100%; width: 100%; }
    
    /* Pulsing SOS Beacon */
    .emergency-beacon {
      position: relative;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .emergency-beacon .dot {
      width: 18px;
      height: 18px;
      background: #EF4444;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.6);
      z-index: 2;
    }
    .emergency-beacon .pulse {
      position: absolute;
      width: 38px;
      height: 38px;
      background: rgba(239, 68, 68, 0.4);
      border-radius: 50%;
      animation: pulse 1.8s infinite ease-out;
      z-index: 1;
    }
    @keyframes pulse {
      0% { transform: scale(0.6); opacity: 0.9; }
      100% { transform: scale(2.2); opacity: 0; }
    }

    /* Responder Live GPS Dot */
    .responder-marker {
      position: relative;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .responder-marker .resp-dot {
      width: 16px;
      height: 16px;
      background: #2563EB;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.5);
      z-index: 2;
    }
    .responder-marker .resp-pulse {
      position: absolute;
      width: 32px;
      height: 32px;
      background: rgba(37, 99, 235, 0.35);
      border-radius: 50%;
      animation: respPulse 2s infinite ease-out;
      z-index: 1;
    }
    @keyframes respPulse {
      0% { transform: scale(0.5); opacity: 0.8; }
      100% { transform: scale(1.8); opacity: 0; }
    }

    /* Nearby Incident Pin */
    .nearby-marker {
      width: 24px;
      height: 24px;
      background: #F59E0B;
      border: 2px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 11px;
      font-weight: bold;
    }

    /* Popup Styling */
    .leaflet-popup-content-wrapper {
      border-radius: 12px;
      padding: 4px;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18);
    }
    .leaflet-popup-content {
      margin: 8px 12px;
      font-size: 13px;
      line-height: 1.4;
      color: #1E293B;
    }
    .popup-title {
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 2px;
    }
    .popup-sub {
      color: #64748B;
      font-size: 11.5px;
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <script>
    var map = L.map('map', {
      zoomControl: ${interactive},
      dragging: ${interactive},
      touchZoom: ${interactive},
      scrollWheelZoom: false,
      doubleClickZoom: ${interactive}
    }).setView([${centerLat}, ${centerLng}], 15);

    // OpenStreetMap Standard Tile Layer
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    var bounds = [];

    // 1. Emergency Location Marker
    ${
      emerLat && emerLng
        ? `
      var emerIcon = L.divIcon({
        className: '',
        html: '<div class="emergency-beacon"><div class="pulse"></div><div class="dot"></div></div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
      });
      var emerMarker = L.marker([${emerLat}, ${emerLng}], { icon: emerIcon }).addTo(map);
      emerMarker.bindPopup('<div class="popup-title">🚨 ${emerTitle}</div><div class="popup-sub">${emerCat.toUpperCase()}</div>');
      bounds.push([${emerLat}, ${emerLng}]);
    `
        : ''
    }

    // 2. Responder Location Marker
    ${
      respLat && respLng
        ? `
      var respIcon = L.divIcon({
        className: '',
        html: '<div class="responder-marker"><div class="resp-pulse"></div><div class="resp-dot"></div></div>',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15]
      });
      var respMarker = L.marker([${respLat}, ${respLng}], { icon: respIcon }).addTo(map);
      respMarker.bindPopup('<div class="popup-title">📍 ${respTitle}</div><div class="popup-sub">Responder Location</div>');
      bounds.push([${respLat}, ${respLng}]);
    `
        : ''
    }

    // 3. Nearby Incidents List
    var nearbyData = ${JSON.stringify(cleanIncidents)};
    nearbyData.forEach(function(inc) {
      var icon = L.divIcon({
        className: '',
        html: '<div class="nearby-marker">!</div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      var m = L.marker([inc.lat, inc.lng], { icon: icon }).addTo(map);
      m.bindPopup('<div class="popup-title">⚠️ ' + inc.title + '</div><div class="popup-sub">' + inc.distance + '</div>');
      bounds.push([inc.lat, inc.lng]);
    });

    // 4. Route Polyline
    var routeCoords = ${JSON.stringify(leafletRoute)};
    if (routeCoords && routeCoords.length > 1 && ${showRoute}) {
      var routeLine = L.polyline(routeCoords, {
        color: '#2563EB',
        weight: 5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      // Add dashed core for modern navigation look
      L.polyline(routeCoords, {
        color: '#93C5FD',
        weight: 2,
        opacity: 0.9,
        dashArray: '6, 6'
      }).addTo(map);

      routeCoords.forEach(function(pt) { bounds.push(pt); });
    }

    // Fit map view nicely to show all markers & route
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    }
  </script>
</body>
</html>
    `;
  }, [emergencyLocation, responderLocation, nearbyIncidents, routeCoordinates, interactive, showRoute]);

  return (
    <View style={[styles.container, { height }, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={C.accent} />
            <Text style={styles.loadingText}>Loading OpenStreetMap...</Text>
          </View>
        )}
      />

      {(distanceText || durationText) && (
        <View style={styles.etaOverlay}>
          <View style={styles.etaBadge}>
            <Text style={styles.etaDuration}>{durationText || 'Fastest Route'}</Text>
            <Text style={styles.etaDistance}> • {distanceText}</Text>
          </View>
          <Text style={styles.osmBrand}>OpenStreetMap</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F1F5F9',
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingWrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '600',
  },
  etaOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  etaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  etaDuration: {
    color: '#10B981',
    fontWeight: '800',
    fontSize: 12.5,
  },
  etaDistance: {
    color: '#F8FAFC',
    fontWeight: '600',
    fontSize: 12.5,
  },
  osmBrand: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 10.5,
    fontWeight: '700',
    color: '#475569',
    overflow: 'hidden',
  },
});
