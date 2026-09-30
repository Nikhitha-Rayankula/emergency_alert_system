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
import { StatCard, Card, Btn, StatusBadge, Empty, SkeletonList, C, SPACE, RADIUS, fmt, getUserDisplayName } from '../ui';
import { useAuth } from '../AuthContext';
import { useToast } from '../Toast';
import api, { errorText } from '../api';
import { getPosition } from '../location';

export default function GuardianDashboard({ navigation }) {
  const { user } = useAuth();
  const toast = useToast();

  const [alerts, setAlerts] = useState([]);
  const [activeSOS, setActiveSOS] = useState([]);
  const [myResponses, setMyResponses] = useState([]);
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

      const [notifsRes, nearbyRes, societyRes] = await Promise.all([
        api.get('/notifications/').catch(() => ({ data: [] })),
        pos ? api.get('/responders/incidents/nearby/', { params: { ...pos, radius: 5000 } }).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        api.get('/gated-society/mine/').catch(() => ({ data: null })),
      ]);

      setAlerts(notifsRes.data || []);
      setActiveSOS(nearbyRes.data || []);
      setSocietyInfo(societyRes.data);
    } catch (e) {
      console.log('Guardian load error:', e.message);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
      const interval = setInterval(loadData, 6000);
      return () => clearInterval(interval);
    }, [loadData])
  );

  const handleAcceptSOS = async (sosId) => {
    setAcceptingId(sosId);
    try {
      await api.patch(`/sos/${sosId}/accept/`, {});
      toast('Emergency Accepted! Launching Navigation...', 'success');
      navigation.navigate('IncidentDetail', { id: sosId });
    } catch (e) {
      Alert.alert('Could Not Accept', errorText(e));
    }
    setAcceptingId(null);
  };

  const unreadAlerts = alerts.filter((n) => !n.is_read);

  const displayName = getUserDisplayName(user);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header
        title={`Hello, ${displayName} 👋`}
        subtitle={societyInfo ? `${societyInfo.society_name}` : 'Family & Flat Protection'}
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
        {/* Protection Overview Card */}
        <Card style={styles.guardianBanner}>
          <View style={styles.bannerHeader}>
            <View style={styles.bannerIconWrap}>
              <Ionicons name="shield-checkmark" size={24} color={C.safeDark} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.bannerTitle}>Guardian Status: Active</Text>
              <Text style={styles.bannerSub}>
                {user?.flat ? `Assigned to Flat #${user.flat}` : 'Protecting family and community'}
              </Text>
            </View>
          </View>

          <View style={styles.bannerQuickActions}>
            <TouchableOpacity
              style={styles.bannerBtn}
              onPress={() => navigation.navigate('FlatMembers')}
              activeOpacity={0.8}
            >
              <Ionicons name="person-add" size={16} color={C.ink} style={{ marginRight: 6 }} />
              <Text style={styles.bannerBtnText}>Add Flat Resident</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.bannerBtn, { backgroundColor: C.accentSoft }]}
              onPress={() => navigation.navigate('Alerts')}
              activeOpacity={0.8}
            >
              <Ionicons name="notifications" size={16} color={C.accentInk} style={{ marginRight: 6 }} />
              <Text style={[styles.bannerBtnText, { color: C.accentInk }]}>
                {unreadAlerts.length} Alerts
              </Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard
            title="Active SOS"
            value={activeSOS.length}
            subtitle="In your community"
            icon="alert-circle"
            color={C.sos}
            bg={C.sosSoft}
          />
          <StatCard
            title="Notifications"
            value={alerts.length}
            subtitle={`${unreadAlerts.length} unread`}
            icon="notifications"
            color={C.accent}
            bg={C.accentSoft}
            onPress={() => navigation.navigate('Alerts')}
          />
        </View>

        {/* Active Emergency Alerts Section */}
        <View style={styles.sectionHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.pulsingDot} />
            <Text style={styles.sectionTitle}>Emergency Incidents Requiring Response</Text>
          </View>
        </View>

        {activeSOS.length === 0 ? (
          <Card style={{ alignItems: 'center', padding: SPACE.xl }}>
            <Ionicons name="checkmark-circle-outline" size={38} color={C.safe} />
            <Text style={{ fontWeight: '800', color: C.ink, fontSize: 16, marginTop: 10 }}>
              All Quiet in Your Community
            </Text>
            <Text style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 4 }}>
              No active emergency requests right now. You will be alerted instantly if help is needed.
            </Text>
          </Card>
        ) : (
          activeSOS.map((inc) => (
            <IncidentCard
              key={inc.id}
              incident={inc}
              showAcceptBtn={true}
              acceptLoading={acceptingId === inc.id}
              distance={inc.distance_meters ? `${inc.distance_meters}m away` : null}
              onPress={() => navigation.navigate('IncidentDetail', { id: inc.id })}
              onAccept={() => handleAcceptSOS(inc.id)}
            />
          ))
        )}

        {/* Recent Notifications Preview */}
        {alerts.length > 0 && (
          <View style={{ marginTop: SPACE.xl }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Emergency Alerts</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Alerts')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            {alerts.slice(0, 3).map((notif) => (
              <Card
                key={notif.id}
                onPress={() => {
                  if (notif.sos) navigation.navigate('IncidentDetail', { id: notif.sos });
                  else navigation.navigate('Alerts');
                }}
                style={!notif.is_read ? { backgroundColor: C.accentSoft } : null}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ fontWeight: '800', color: C.ink, fontSize: 14 }}>{notif.title}</Text>
                  <Text style={{ fontSize: 11, color: C.muted }}>{fmt(notif.created_at)}</Text>
                </View>
                <Text style={{ color: C.ink2, marginTop: 4, fontSize: 12.5 }} numberOfLines={2}>
                  {notif.message}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  guardianBanner: {
    backgroundColor: C.safeSoft,
    borderColor: C.safe + '40',
    borderWidth: 1.5,
    marginBottom: SPACE.md,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: C.safeInk,
  },
  bannerSub: {
    fontSize: 12.5,
    color: C.safeDark,
    marginTop: 2,
    fontWeight: '500',
  },
  bannerQuickActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SPACE.md,
    paddingTop: SPACE.sm,
    borderTopWidth: 1,
    borderTopColor: C.safe + '33',
  },
  bannerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 9,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.line,
  },
  bannerBtnText: {
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
  pulsingDot: {
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
  viewAllText: {
    color: C.accent,
    fontWeight: '700',
    fontSize: 13,
  },
});
