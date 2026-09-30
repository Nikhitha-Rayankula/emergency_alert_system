import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  Switch,
  TouchableOpacity,
  Alert,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import IncidentCard from '../components/IncidentCard';
import { StatCard, Card, Btn, Chip, Empty, SkeletonList, C, SPACE, RADIUS, fmt, getUserDisplayName } from '../ui';
import { useAuth } from '../AuthContext';
import { useToast } from '../Toast';
import api, { errorText } from '../api';
import { getPosition } from '../location';

const RADIUS_OPTIONS = [
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
];

export default function VolunteerDashboard({ navigation }) {
  const { user } = useAuth();
  const toast = useToast();

  const [available, setAvailable] = useState(user?.available ?? true);
  const [radius, setRadius] = useState(2000);
  const [incidents, setIncidents] = useState([]);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);

  const loadNearby = useCallback(async () => {
    try {
      const pos = await getPosition();
      setLocation(pos);

      // Sync volunteer location to backend
      api.patch('/users/me/location/', pos).catch(() => {});

      // Fetch nearby open incidents
      const { data } = await api.get('/responders/incidents/nearby/', {
        params: {
          latitude: pos.latitude,
          longitude: pos.longitude,
          radius: radius,
        },
      });

      setIncidents(data || []);
    } catch (e) {
      console.log('Volunteer nearby load error:', e.message);
    }
    setLoading(false);
    setRefreshing(false);
  }, [radius]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadNearby();
      const interval = setInterval(loadNearby, 6000);
      return () => clearInterval(interval);
    }, [loadNearby])
  );

  const toggleAvailability = async (val) => {
    setAvailable(val);
    try {
      await api.patch('/responders/me/availability/', { available: val });
      toast(val ? 'You are marked as Available to respond' : 'Availability set to Offline', val ? 'success' : 'info');
    } catch (e) {
      setAvailable(!val);
      Alert.alert('Could Not Update Availability', errorText(e));
    }
  };

  const handleAccept = async (id) => {
    setAcceptingId(id);
    try {
      await api.patch(`/sos/${id}/accept/`, {});
      toast('Incident Accepted! Launching OpenStreetMap Navigation...', 'success');
      navigation.navigate('IncidentDetail', { id });
    } catch (e) {
      Alert.alert('Could Not Accept', errorText(e));
    }
    setAcceptingId(null);
  };

  const displayName = getUserDisplayName(user);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header
        title={`Hello, ${displayName} 👋`}
        subtitle="Volunteer • Community First Responder"
        onRefresh={() => {
          setRefreshing(true);
          loadNearby();
        }}
      />

      <ScrollView
        contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadNearby();
            }}
          />
        }
      >
        {/* Availability Toggle Card */}
        <Card
          style={[
            styles.availCard,
            { borderColor: available ? C.safe : C.line },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <View
                style={[
                  styles.statusBeacon,
                  { backgroundColor: available ? C.safe : C.muted },
                ]}
              />
              <View style={{ marginLeft: 10 }}>
                <Text style={styles.availTitle}>
                  {available ? 'Status: On-Duty & Available' : 'Status: Currently Offline'}
                </Text>
                <Text style={styles.availSub}>
                  {available
                    ? 'You will receive nearby emergency push alerts'
                    : 'Turn on when you are ready to assist neighbours'}
                </Text>
              </View>
            </View>

            <Switch
              value={available}
              onValueChange={toggleAvailability}
              trackColor={{ false: '#CBD5E1', true: C.safe }}
              thumbColor="#FFFFFF"
            />
          </View>
        </Card>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard
            title="Nearby Open SOS"
            value={incidents.length}
            subtitle={`Within ${(radius / 1000).toFixed(0)} km`}
            icon="alert-circle"
            color={incidents.length > 0 ? C.sos : C.safe}
            bg={incidents.length > 0 ? C.sosSoft : C.safeSoft}
          />
          <StatCard
            title="Interactive Map"
            value="View"
            subtitle="Radar View"
            icon="map"
            color={C.accent}
            bg={C.accentSoft}
            onPress={() => navigation.navigate('NearbyMap')}
          />
        </View>

        {/* Radius Filter */}
        <View style={styles.radiusHeader}>
          <Text style={styles.sectionTitle}>Search Radius</Text>
          <View style={styles.radiusChips}>
            {RADIUS_OPTIONS.map((opt) => (
              <Chip
                key={opt.value}
                label={opt.label}
                active={radius === opt.value}
                onPress={() => setRadius(opt.value)}
              />
            ))}
          </View>
        </View>

        {/* Live GPS Bar */}
        {location && (
          <View style={styles.gpsBar}>
            <Ionicons name="location" size={14} color={C.safeDark} />
            <Text style={styles.gpsText}>
              Your GPS: {location.latitude}, {location.longitude}
            </Text>
            <TouchableOpacity onPress={loadNearby} style={{ marginLeft: 'auto' }}>
              <Text style={styles.gpsRefresh}>Refresh</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Nearby Incidents List */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            Emergency Incidents Nearby ({incidents.length})
          </Text>
        </View>

        {incidents.length === 0 ? (
          <Card style={{ alignItems: 'center', padding: SPACE.xl }}>
            <Ionicons name="shield-checkmark" size={38} color={C.safe} />
            <Text style={{ fontWeight: '800', color: C.ink, fontSize: 16, marginTop: 10 }}>
              No Open Incidents in Your Area
            </Text>
            <Text style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
              Great news! There are no unresolved emergencies within {(radius / 1000).toFixed(0)} km.
            </Text>
          </Card>
        ) : (
          incidents.map((inc) => (
            <IncidentCard
              key={inc.id}
              incident={inc}
              showAcceptBtn={true}
              acceptLoading={acceptingId === inc.id}
              distance={inc.distance_meters ? `${inc.distance_meters} m away` : null}
              onPress={() => navigation.navigate('IncidentDetail', { id: inc.id })}
              onAccept={() => handleAccept(inc.id)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  availCard: {
    borderWidth: 1.5,
    marginBottom: SPACE.md,
  },
  statusBeacon: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  availTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
  },
  availSub: {
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: SPACE.lg,
  },
  radiusHeader: {
    marginBottom: SPACE.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.ink,
    marginBottom: 6,
  },
  radiusChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gpsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: SPACE.md,
  },
  gpsText: {
    fontSize: 12,
    color: C.ink2,
    fontWeight: '600',
    marginLeft: 6,
  },
  gpsRefresh: {
    fontSize: 12,
    fontWeight: '700',
    color: C.accent,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACE.sm,
  },
});
