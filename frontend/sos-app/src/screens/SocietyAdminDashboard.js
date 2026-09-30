import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import { StatCard, Card, Btn, Chip, StatusBadge, Empty, SkeletonList, C, SPACE, RADIUS, fmt, getUserDisplayName } from '../ui';
import { useAuth } from '../AuthContext';
import api, { errorText } from '../api';

export default function SocietyAdminDashboard({ navigation }) {
  const { user } = useAuth();

  const [society, setSociety] = useState(null);
  const [users, setUsers] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [socRes, usersRes, notifsRes] = await Promise.all([
        api.get('/gated-society/mine/').catch(() => ({ data: null })),
        api.get('/society/users/').catch(() => ({ data: [] })),
        api.get('/notifications/').catch(() => ({ data: [] })),
      ]);

      setSociety(socRes.data);
      setUsers(usersRes.data || []);
    } catch (e) {
      console.log('Subadmin load error:', e.message);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData])
  );

  // Derive real statistics from backend data
  const residentsCount = users.filter((u) => u.group_name === 'Resident').length;
  const guardiansCount = users.filter((u) => u.group_name === 'Guardian').length;
  const volunteersCount = users.filter((u) => u.group_name === 'Volunteer').length;
  const securityCount = users.filter((u) => u.group_name === 'Security').length;

  const displayName = getUserDisplayName(user);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header
        title={`Hello, ${displayName} 👋`}
        subtitle={society ? society.society_name : 'Society Administration'}
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
        {/* Society Info Banner */}
        <Card style={styles.socBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.socIconWrap}>
              <Ionicons name="business" size={24} color={C.purpleInk} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.socTitle}>{society?.society_name || 'My Gated Society'}</Text>
              <Text style={styles.socSub}>
                Incharge: {society?.incharge || user?.username} • Owner: {society?.owner_name || 'Society Office'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Real KPI Statistics Grid */}
        <Text style={styles.sectionTitle}>Society Overview & Member Breakdown</Text>
        <View style={styles.statsGrid}>
          <StatCard
            title="Total Members"
            value={users.length}
            subtitle="Registered users"
            icon="people"
            color={C.ink}
            bg="#F1F5F9"
            onPress={() => navigation.navigate('People')}
          />
          <StatCard
            title="Residents"
            value={residentsCount}
            subtitle="Flat residents"
            icon="home"
            color={C.accent}
            bg={C.accentSoft}
            onPress={() => navigation.navigate('People')}
          />
        </View>

        <View style={[styles.statsGrid, { marginTop: 10 }]}>
          <StatCard
            title="Guardians"
            value={guardiansCount}
            subtitle="Flat guardians"
            icon="shield-checkmark"
            color={C.safeDark}
            bg={C.safeSoft}
            onPress={() => navigation.navigate('People')}
          />
          <StatCard
            title="Volunteers"
            value={volunteersCount}
            subtitle="First responders"
            icon="heart"
            color={C.warnDark}
            bg={C.warnSoft}
            onPress={() => navigation.navigate('People')}
          />
          <StatCard
            title="Security"
            value={securityCount}
            subtitle="Gate staff"
            icon="shield-account"
            iconSet="mci"
            color={C.purpleInk}
            bg={C.purpleSoft}
            onPress={() => navigation.navigate('People')}
          />
        </View>

        {/* Quick Management Hub */}
        <Text style={[styles.sectionTitle, { marginTop: SPACE.xl }]}>Management & Controls</Text>
        <View style={styles.mgmtGrid}>
          <Card
            onPress={() => navigation.navigate('Structure')}
            style={styles.mgmtCard}
          >
            <View style={[styles.mgmtIconWrap, { backgroundColor: C.accentSoft }]}>
              <Ionicons name="grid" size={22} color={C.accent} />
            </View>
            <Text style={styles.mgmtTitle}>Blocks & Flats</Text>
            <Text style={styles.mgmtSub}>Structure, towers & flats</Text>
          </Card>

          <Card
            onPress={() => navigation.navigate('People')}
            style={styles.mgmtCard}
          >
            <View style={[styles.mgmtIconWrap, { backgroundColor: C.safeSoft }]}>
              <Ionicons name="person-add" size={22} color={C.safeDark} />
            </View>
            <Text style={styles.mgmtTitle}>Member Directory</Text>
            <Text style={styles.mgmtSub}>Invite volunteers & staff</Text>
          </Card>
        </View>

        <View style={[styles.mgmtGrid, { marginTop: 10 }]}>
          <Card
            onPress={() => navigation.navigate('Escalation')}
            style={styles.mgmtCard}
          >
            <View style={[styles.mgmtIconWrap, { backgroundColor: C.warnSoft }]}>
              <Ionicons name="git-network" size={22} color={C.warnDark} />
            </View>
            <Text style={styles.mgmtTitle}>Escalation Rules</Text>
            <Text style={styles.mgmtSub}>Timeouts & alert tiers</Text>
          </Card>

          <Card
            onPress={() => navigation.navigate('Alerts')}
            style={styles.mgmtCard}
          >
            <View style={[styles.mgmtIconWrap, { backgroundColor: C.sosSoft }]}>
              <Ionicons name="notifications" size={22} color={C.sos} />
            </View>
            <Text style={styles.mgmtTitle}>Emergency Alerts</Text>
            <Text style={styles.mgmtSub}>Society incident feed</Text>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  socBanner: {
    backgroundColor: C.purpleSoft,
    borderColor: C.purple + '33',
    borderWidth: 1.5,
    marginBottom: SPACE.md,
  },
  socIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: C.purpleInk,
  },
  socSub: {
    fontSize: 12.5,
    color: C.ink3,
    marginTop: 2,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.ink,
    marginBottom: SPACE.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  mgmtGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  mgmtCard: {
    flex: 1,
    padding: SPACE.md,
    alignItems: 'flex-start',
  },
  mgmtIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  mgmtTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.ink,
  },
  mgmtSub: {
    fontSize: 11.5,
    color: C.muted,
    marginTop: 2,
  },
});
