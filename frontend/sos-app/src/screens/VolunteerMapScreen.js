import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import OSMMapView from '../components/OSMMapView';
import { Card, Chip, C, SPACE, RADIUS } from '../ui';
import api from '../api';
import { getPosition } from '../location';

export default function VolunteerMapScreen({ navigation }) {
  const [location, setLocation] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const pos = await getPosition();
      setLocation(pos);

      const { data } = await api.get('/responders/incidents/nearby/', {
        params: {
          latitude: pos.latitude,
          longitude: pos.longitude,
          radius: 5000,
        },
      });

      setIncidents(data || []);
    } catch (e) {
      console.log('Map radar error:', e.message);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header
        title="Emergency Radar Map"
        subtitle="OpenStreetMap live incident view"
        onRefresh={loadData}
      />

      <View style={styles.container}>
        {location ? (
          <OSMMapView
            height="100%"
            style={{ flex: 1, borderRadius: 0 }}
            responderLocation={{
              latitude: Number(location.latitude),
              longitude: Number(location.longitude),
              title: 'Your GPS Position',
            }}
            nearbyIncidents={incidents}
            showRoute={false}
          />
        ) : (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={{ marginTop: 10, color: C.muted, fontWeight: '600' }}>
              Acquiring GPS location...
            </Text>
          </View>
        )}

        {/* Floating Incident Counter Badge */}
        <View style={styles.floatingStats}>
          <View style={styles.statPill}>
            <View style={[styles.dot, { backgroundColor: incidents.length > 0 ? C.sos : C.safe }]} />
            <Text style={styles.statText}>
              {incidents.length} Emergency Alerts in 5 km Radius
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  floatingStats: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12.5,
  },
});
