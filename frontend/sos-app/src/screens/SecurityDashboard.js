import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import IncidentCard from '../components/IncidentCard';
import { StatCard, Card, Btn, Empty, SkeletonList, C, SPACE, RADIUS, fmt, getUserDisplayName } from '../ui';
import { useAuth } from '../AuthContext';
import { useToast } from '../Toast';
import api, { errorText } from '../api';
import { getPosition } from '../location';

export default function SecurityDashboard({ navigation }) {
  const { user } = useAuth();
  const toast = useToast();

  const [incidents, setIncidents] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [societyInfo, setSocietyInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const pos = await getPosition().catch(() => null);
      if (pos) {
        api.patch('/users/me/location/', pos).catch(() => {});
      }

      const [nearbyRes, notifRes, societyRes] = await Promise.all([
        pos
          ? api.get('/responders/incidents/nearby/', { params: { ...pos, radius: 5000 } }).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] }),
        api.get('/notifications/').catch(() => ({ data: [] })),
        api.get('/gated-society/mine/').catch(() => ({ data: null })),
      ]);

      setIncidents(nearbyRes.data || []);
      setNotifications(notifRes.data || []);
      setSocietyInfo(societyRes.data);
    } catch (e) {
      console.log('Security load error:', e.message);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
      const interval = setInterval(loadData, 5000);
      return () => clearInterval(interval);
    }, [loadData])
  );

  const handleAccept = async (id) => {
    setAcceptingId(id);
    try {
      await api.patch(`/sos/${id}/accept/`, {});
      toast('Incident Accepted! Launching Security Dispatch Route...', 'success');
      navigation.navigate('IncidentDetail', { id });
    } catch (e) {
      Alert.alert('Could Not Accept', errorText(e));
    }
    setAcceptingId(null);
  };

  const unreadAlerts = notifications.filter((n) => !n.is_read);
  const displayName = getUserDisplayName(user);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header
        title={`Hello, ${displayName} 👋`}
        subtitle={societyInfo ? `${societyInfo.society_name} • Security` : 'Security Command Operations'}
        onRefresh={() => {
          setRefreshing(true);
          loadData();
        }}
      />

      <ScrollView
        contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
          />
        }
      >
        {/* Security Command Banner */}
        <Card style={styles.securityBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.securityIconWrap}>
              <MaterialCommunityIcons name="shield-account" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.securityTitle}>On-Duty Security Staff</Text>
              <Text style={styles.securitySub}>
                {societyInfo ? `${societyInfo.society_name} • Incharge: ${societyInfo.incharge}` : 'Gate & Society Guard'}
              </Text>
            </View>
          </View>

          <View style={styles.quickActionRow}>
            <TouchableOpacity
              style={styles.quickActionBtn}
              onPress={() => navigation.navigate('Incidents')}
              activeOpacity={0.8}
            >
              <Ionicons name="list" size={16} color={C.ink} style={{ marginRight: 6 }} />
              <Text style={styles.quickActionText}>All Society Incidents</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickActionBtn, { backgroundColor: C.accentSoft }]}
              onPress={() => navigation.navigate('Alerts')}
              activeOpacity={0.8}
            >
              <Ionicons name="notifications" size={16} color={C.accentInk} style={{ marginRight: 6 }} />
              <Text style={[styles.quickActionText, { color: C.accentInk }]}>
                {unreadAlerts.length} Alerts
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard
            title="Active Incidents"
            value={incidents.length}
            subtitle="Requires Security"
            icon="shield-alert"
            iconSet="mci"
            color={incidents.length > 0 ? C.sos : C.safe}
            bg={incidents.length > 0 ? C.sosSoft : C.safeSoft}
          />
          <StatCard
            title="Security Alerts"
            value={notifications.length}
            subtitle={`${unreadAlerts.length} new`}
            icon="notifications"
            color={C.accent}
            bg={C.accentSoft}
            onPress={() => navigation.navigate('Alerts')}
          />
        </View>

        {/* Active Emergency Section */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.pulsingRedDot} />
            <Text style={styles.sectionTitle}>Urgent Incidents ({incidents.length})</Text>
          </View>
        </View>

        {incidents.length === 0 ? (
          <Card style={{ alignItems: 'center', padding: SPACE.xl }}>
            <Ionicons name="shield-checkmark" size={38} color={C.safe} />
            <Text style={{ fontWeight: '800', color: C.ink, fontSize: 16, marginTop: 10 }}>
              All Society Zones Clear
            </Text>
            <Text style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
              No active emergency calls in the society premises at this moment.
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
  securityBanner: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    marginBottom: SPACE.md,
  },
  securityIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: C.warn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  securitySub: {
    fontSize: 12.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SPACE.md,
    paddingTop: SPACE.sm,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 9,
    borderRadius: RADIUS.md,
  },
  quickActionText: {
    fontWeight: '700',
    fontSize: 12.5,
    color: C.ink,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: SPACE.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACE.sm,
  },
  pulsingRedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.sos,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.ink,
  },
});
