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
import ActionModal from '../components/ActionModal';
import { StatCard, Card, Btn, Chip, Field, StatusBadge, Empty, SkeletonList, C, SPACE, RADIUS, fmt, getUserDisplayName } from '../ui';
import { useAuth } from '../AuthContext';
import { useToast } from '../Toast';
import api, { errorText } from '../api';

export default function PlatformAdminDashboard({ navigation }) {
  const { user } = useAuth();
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [societies, setSocieties] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Quick Action Modals
  const [addSocietyModal, setAddSocietyModal] = useState(false);
  const [socForm, setSocForm] = useState({ society_name: '', owner_name: '', incharge: '', sub_admin_username: '' });
  const [busy, setBusy] = useState(false);

  const loadPlatformData = useCallback(async () => {
    try {
      const [usersRes, notifsRes, socRes] = await Promise.all([
        api.get('/society/users/').catch(() => ({ data: [] })),
        api.get('/notifications/').catch(() => ({ data: [] })),
        api.get('/gated-society/').catch(() => ({ data: [] })),
      ]);

      setUsers(usersRes.data || []);
      setNotifications(notifsRes.data || []);
      const socList = Array.isArray(socRes.data) ? socRes.data : (socRes.data ? [socRes.data] : []);
      setSocieties(socList);
    } catch (e) {
      console.log('Platform admin load error:', e.message);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadPlatformData();
    }, [loadPlatformData])
  );

  const handleCreateSociety = async () => {
    if (!socForm.society_name.trim() || !socForm.owner_name.trim() || !socForm.incharge.trim()) {
      Alert.alert('Fields Required', 'Please fill in society name, owner name, and incharge.');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        society_name: socForm.society_name.trim(),
        owner_name: socForm.owner_name.trim(),
        incharge: socForm.incharge.trim(),
      };
      if (socForm.sub_admin_username.trim()) {
        payload.sub_admin_username = socForm.sub_admin_username.trim();
      }

      await api.post('/gated-society/add/', payload);
      setAddSocietyModal(false);
      setSocForm({ society_name: '', owner_name: '', incharge: '', sub_admin_username: '' });
      toast('Gated Society registered successfully!', 'success');
      loadPlatformData();
    } catch (e) {
      Alert.alert('Failed to Create Society', errorText(e));
    }
    setBusy(false);
  };

  // Real Stats calculated from real backend data
  const totalUsers = users.length;
  const totalSocieties = societies.length;
  const residents = users.filter((u) => u.group_name === 'Resident').length;
  const subAdmins = users.filter((u) => u.group_name === 'Sub Admin').length;
  const guardians = users.filter((u) => u.group_name === 'Guardian').length;
  const volunteers = users.filter((u) => u.group_name === 'Volunteer').length;
  const securityStaff = users.filter((u) => u.group_name === 'Security').length;

  const displayName = getUserDisplayName(user);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header
        title={`Hello, ${displayName} 👋`}
        subtitle="Platform Admin • Superadmin Control Center"
        onRefresh={() => {
          setRefreshing(true);
          loadPlatformData();
        }}
      />

      <ScrollView
        contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadPlatformData();
            }}
          />
        }
      >
        {/* Superadmin System Banner */}
        <Card style={styles.adminBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.adminIconWrap}>
              <MaterialCommunityIcons name="shield-crown" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.adminTitle}>Superadmin Root Access</Text>
              <Text style={styles.adminSub}>
                Full platform governance, gated society administration & analytics
              </Text>
            </View>
          </View>
        </Card>

        {/* Real KPI Stats */}
        <Text style={styles.sectionTitle}>Platform Metrics & User Demographics</Text>
        <View style={styles.statsGrid}>
          <StatCard
            title="Total Users"
            value={totalUsers}
            subtitle="Platform-wide"
            icon="people"
            color={C.ink}
            bg="#F1F5F9"
            onPress={() => navigation.navigate('Users')}
          />
          <StatCard
            title="Societies"
            value={totalSocieties}
            subtitle="Gated Communities"
            icon="business"
            color={C.purpleInk}
            bg={C.purpleSoft}
            onPress={() => navigation.navigate('Societies')}
          />
        </View>

        <View style={[styles.statsGrid, { marginTop: 10 }]}>
          <StatCard
            title="Residents"
            value={residents}
            subtitle="Community members"
            icon="home"
            color={C.accent}
            bg={C.accentSoft}
            onPress={() => navigation.navigate('Users')}
          />
          <StatCard
            title="Guardians"
            value={guardians}
            subtitle="Flat guardians"
            icon="shield-checkmark"
            color={C.safeDark}
            bg={C.safeSoft}
            onPress={() => navigation.navigate('Users')}
          />
        </View>

        <View style={[styles.statsGrid, { marginTop: 10 }]}>
          <StatCard
            title="Volunteers"
            value={volunteers}
            subtitle="First responders"
            icon="heart"
            color={C.warnDark}
            bg={C.warnSoft}
            onPress={() => navigation.navigate('Users')}
          />
          <StatCard
            title="Security"
            value={securityStaff}
            subtitle="Security personnel"
            icon="shield-account"
            iconSet="mci"
            color={C.purpleInk}
            bg={C.purpleSoft}
            onPress={() => navigation.navigate('Users')}
          />
        </View>

        {/* Platform Control Actions */}
        <Text style={[styles.sectionTitle, { marginTop: SPACE.xl }]}>Superadmin Quick Operations</Text>
        <View style={styles.actionGrid}>
          <Card
            onPress={() => setAddSocietyModal(true)}
            style={styles.actionCard}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: C.accentSoft }]}>
              <Ionicons name="add-circle" size={22} color={C.accent} />
            </View>
            <Text style={styles.actionTitle}>Register Society</Text>
            <Text style={styles.actionSub}>Add new gated community</Text>
          </Card>

          <Card
            onPress={() => navigation.navigate('Societies')}
            style={styles.actionCard}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: C.purpleSoft }]}>
              <Ionicons name="business" size={22} color={C.purpleInk} />
            </View>
            <Text style={styles.actionTitle}>Manage Societies</Text>
            <Text style={styles.actionSub}>Edit, assign & delete</Text>
          </Card>
        </View>

        <View style={[styles.actionGrid, { marginTop: 10 }]}>
          <Card
            onPress={() => navigation.navigate('Users')}
            style={styles.actionCard}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: C.safeSoft }]}>
              <Ionicons name="people" size={22} color={C.safeDark} />
            </View>
            <Text style={styles.actionTitle}>Platform Users</Text>
            <Text style={styles.actionSub}>Full member directory</Text>
          </Card>

          <Card
            onPress={() => navigation.navigate('Incidents')}
            style={styles.actionCard}
          >
            <View style={[styles.actionIconWrap, { backgroundColor: C.sosSoft }]}>
              <Ionicons name="warning" size={22} color={C.sos} />
            </View>
            <Text style={styles.actionTitle}>Incident Monitor</Text>
            <Text style={styles.actionSub}>System-wide emergency feed</Text>
          </Card>
        </View>
      </ScrollView>

      {/* Add Society Modal */}
      <ActionModal
        visible={addSocietyModal}
        onClose={() => setAddSocietyModal(false)}
        title="Register Gated Society"
        subtitle="Provision a new community on the platform."
        submitText="Create Society"
        loading={busy}
        onSubmit={handleCreateSociety}
      >
        <Field
          label="Society Name"
          value={socForm.society_name}
          onChangeText={(v) => setSocForm({ ...socForm, society_name: v })}
          placeholder="e.g. Green Valley Heights"
        />
        <Field
          label="Owner / Management Body"
          value={socForm.owner_name}
          onChangeText={(v) => setSocForm({ ...socForm, owner_name: v })}
          placeholder="e.g. Green Valley RWA"
        />
        <Field
          label="Incharge / Facility Head"
          value={socForm.incharge}
          onChangeText={(v) => setSocForm({ ...socForm, incharge: v })}
          placeholder="e.g. Mr. Sharma (Secretary)"
        />
        <Field
          label="Sub Admin Username (Optional)"
          value={socForm.sub_admin_username}
          onChangeText={(v) => setSocForm({ ...socForm, sub_admin_username: v })}
          placeholder="e.g. subadmin_user"
          hint="Username of an existing user in Sub Admin group"
        />
      </ActionModal>
    </View>
  );
}

const styles = StyleSheet.create({
  adminBanner: {
    backgroundColor: '#0F172A',
    borderColor: '#1E293B',
    marginBottom: SPACE.md,
  },
  adminIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: C.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  adminSub: {
    fontSize: 12.5,
    color: '#94A3B8',
    marginTop: 2,
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
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionCard: {
    flex: 1,
    padding: SPACE.md,
    alignItems: 'flex-start',
  },
  actionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.ink,
  },
  actionSub: {
    fontSize: 11.5,
    color: C.muted,
    marginTop: 2,
  },
});
