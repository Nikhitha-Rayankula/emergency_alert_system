import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, Alert, StyleSheet, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import ActionModal from '../components/ActionModal';
import { Card, Btn, Field, PasswordField, Empty, SkeletonList, C, SPACE, RADIUS } from '../ui';
import { useAuth } from '../AuthContext';
import { useToast } from '../Toast';
import api, { errorText } from '../api';

export default function FlatMembersScreen({ navigation }) {
  const { user } = useAuth();
  const toast = useToast();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Add resident modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', mobile: '', password: '' });
  const [busy, setBusy] = useState(false);

  const loadMembers = useCallback(async () => {
    try {
      // Fetch society / flat users
      const res = await api.get('/society/users/');
      setMembers(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.log('Load members error:', errorText(e));
      setMembers([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadMembers();
    }, [loadMembers])
  );

  const handleAddResident = async () => {
    if (!form.username.trim() || !form.email.trim() || !form.password) {
      Alert.alert('Missing Fields', 'Please provide a username, email, and password (min 8 chars).');
      return;
    }

    setBusy(true);
    try {
      await api.post('/add-resident/', {
        username: form.username.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        password: form.password,
      });

      setModalVisible(false);
      setForm({ username: '', email: '', mobile: '', password: '' });
      toast('Resident added to your flat successfully!', 'success');
      loadMembers();
    } catch (e) {
      Alert.alert('Could Not Add Resident', errorText(e));
    }
    setBusy(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header
        title="Flat Members"
        subtitle={user?.flat ? `Flat #${user.flat} • Resident Management` : 'Manage Family Members'}
        onRefresh={() => {
          setRefreshing(true);
          loadMembers();
        }}
      />

      <View style={styles.topActionBar}>
        <Text style={styles.sectionTitle}>Residents & Dependents</Text>
        <Btn
          title="+ Add Resident"
          small
          kind="primary"
          onPress={() => setModalVisible(true)}
          icon={<Ionicons name="person-add" size={15} color="#fff" />}
        />
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 40 }}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          loadMembers();
        }}
        ListEmptyComponent={
          loading ? (
            <SkeletonList rows={3} />
          ) : (
            <Empty
              title="No Residents Registered Yet"
              text="Add family members or dependents to your flat so they can raise one-tap SOS emergencies."
              icon={<Ionicons name="people-outline" size={32} color={C.accent} />}
            />
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.memberCard}>
            <View style={styles.memberRow}>
              <View style={styles.memberAvatar}>
                <Ionicons name="person" size={20} color={C.accentInk} />
              </View>

              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={styles.memberName}>{item.username}</Text>
                  <View style={styles.groupBadge}>
                    <Text style={styles.groupBadgeText}>{item.group_name || 'Resident'}</Text>
                  </View>
                </View>
                <Text style={styles.memberEmail}>{item.email}</Text>
                {item.mobile ? <Text style={styles.memberPhone}>{item.mobile}</Text> : null}
              </View>
            </View>
          </Card>
        )}
      />

      {/* Add Resident Modal */}
      <ActionModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Add Resident to Flat"
        subtitle="Create an account for a family member or dependent."
        submitText="Add Resident"
        loading={busy}
        onSubmit={handleAddResident}
      >
        <Field
          label="Username"
          value={form.username}
          onChangeText={(v) => setForm({ ...form, username: v })}
          placeholder="e.g. JohnDoe"
        />
        <Field
          label="Email Address"
          value={form.email}
          onChangeText={(v) => setForm({ ...form, email: v })}
          placeholder="resident@example.com"
          keyboardType="email-address"
        />
        <Field
          label="Mobile Phone"
          value={form.mobile}
          onChangeText={(v) => setForm({ ...form, mobile: v })}
          placeholder="+91 9876543210"
          keyboardType="phone-pad"
        />
        <PasswordField
          label="Password (min 8 characters)"
          value={form.password}
          onChangeText={(v) => setForm({ ...form, password: v })}
          placeholder="Set a password"
        />
      </ActionModal>
    </View>
  );
}

const styles = StyleSheet.create({
  topActionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
  },
  memberCard: {
    padding: SPACE.md,
    marginBottom: SPACE.sm,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberName: {
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
  },
  groupBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    marginLeft: 8,
  },
  groupBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: C.ink3,
  },
  memberEmail: {
    fontSize: 12.5,
    color: C.muted,
    marginTop: 2,
  },
  memberPhone: {
    fontSize: 12,
    color: C.ink3,
    marginTop: 2,
  },
});
