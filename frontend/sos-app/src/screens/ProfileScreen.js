import React, { useState } from 'react';
import { Text, View, ScrollView, Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, Btn, Field, C, SPACE, RADIUS, IdBadge, fmtSocId, fmtBlkId, fmtFltId, fmtUsrId } from '../ui';
import { useAuth } from '../AuthContext';
import api, { errorText } from '../api';
import { useToast } from '../Toast';

const blank = (c) => ({ name: c?.name || '', phone_number: c?.phone_number || '' });

export default function ProfileScreen({ navigation }) {
  const toast = useToast();
  const { user, logout, refreshUser } = useAuth();

  const [first, setFirst] = useState(user?.first_name || '');
  const [last, setLast] = useState(user?.last_name || '');
  const [mobile, setMobile] = useState(user?.mobile || '');
  const [contacts, setContacts] = useState(
    [user?.emergency_contact1, user?.emergency_contact2, user?.emergency_contact3].map(blank)
  );
  const [busy, setBusy] = useState(false);
  const isResident = user?.group_name === 'Resident';

  const setContact = (i, k, v) =>
    setContacts(contacts.map((c, n) => (n === i ? { ...c, [k]: v } : c)));

  const save = async () => {
    setBusy(true);
    try {
      const body = { first_name: first.trim(), last_name: last.trim(), mobile: mobile.trim() };
      if (isResident) {
        contacts.forEach((c, i) => {
          body[`emergency_contact${i + 1}`] =
            c.name || c.phone_number ? { name: c.name, phone_number: c.phone_number } : null;
        });
      }
      await api.patch('/profile/update/', body);
      await refreshUser();
      toast('Profile updated successfully', 'success');
    } catch (e) {
      Alert.alert('Could Not Save', errorText(e));
    }
    setBusy(false);
  };

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete Account?',
      'Are you sure you want to permanently delete your profile? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('/profile/delete/');
              toast('Account deleted', 'info');
              logout();
            } catch (e) {
              Alert.alert('Error', errorText(e));
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header
        title="My Account"
        subtitle={`${user?.username} • ${fmtUsrId(user?.id)}`}
      />

      <ScrollView contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 50 }} keyboardShouldPersistTaps="handled">
        {/* User Card */}
        <Card style={styles.profileCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.username || 'U').substring(0, 2).toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1, marginLeft: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={styles.userName}>{user?.username}</Text>
                <IdBadge id={user?.id} prefix="USR" size="sm" />
              </View>
              <Text style={styles.userEmail}>{user?.email}</Text>
              <View style={[styles.roleBadge, { backgroundColor: C.accentSoft }]}>
                <Text style={[styles.roleBadgeText, { color: C.accentInk }]}>{user?.group_name}</Text>
              </View>
            </View>
          </View>

          <View style={styles.socDivider} />

          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: C.muted, fontSize: 12.5 }}>Assigned Society:</Text>
              <Text style={{ fontWeight: '700', color: C.ink, fontSize: 12.5 }}>
                {user?.society_name || (user?.gated_society ? `Society #${user.gated_society}` : 'Not Assigned')}{' '}
                {user?.gated_society ? `(${fmtSocId(user.gated_society)})` : ''}
              </Text>
            </View>

            {user?.block_name && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: C.muted, fontSize: 12.5 }}>Assigned Block:</Text>
                <Text style={{ fontWeight: '700', color: C.ink, fontSize: 12.5 }}>
                  {user.block_name} ({fmtBlkId(user.block_id)})
                </Text>
              </View>
            )}

            {(user?.flat_number || user?.flat) && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: C.muted, fontSize: 12.5 }}>Assigned Flat:</Text>
                <Text style={{ fontWeight: '700', color: C.ink, fontSize: 12.5 }}>
                  Flat #{user.flat_number || user.flat} ({fmtFltId(user.flat_id || user.flat)})
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* Profile Edit Fields */}
        <Text style={styles.sectionTitle}>Personal Details</Text>
        <Card>
          <Field
            label="First Name"
            value={first}
            onChangeText={setFirst}
            placeholder="e.g. John"
            autoCapitalize="words"
          />
          <Field
            label="Last Name"
            value={last}
            onChangeText={setLast}
            placeholder="e.g. Doe"
            autoCapitalize="words"
          />
          <Field
            label="Mobile Phone"
            value={mobile}
            onChangeText={setMobile}
            keyboardType="phone-pad"
            placeholder="+91 9876543210"
          />
        </Card>

        {/* Resident Emergency Contacts */}
        {isResident && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: SPACE.lg }]}>Emergency Contacts</Text>
            <Card>
              <Text style={{ color: C.muted, fontSize: 12.5, marginBottom: 12 }}>
                These contacts receive automated SMS notifications during high-priority emergencies.
              </Text>

              {contacts.map((c, i) => (
                <View key={i} style={styles.contactBlock}>
                  <Text style={styles.contactLabel}>Emergency Contact #{i + 1}</Text>
                  <Field
                    label="Contact Name"
                    value={c.name}
                    onChangeText={(v) => setContact(i, 'name', v)}
                    placeholder="e.g. Spouse / Parent"
                    autoCapitalize="words"
                  />
                  <Field
                    label="Phone Number"
                    value={c.phone_number}
                    onChangeText={(v) => setContact(i, 'phone_number', v)}
                    keyboardType="phone-pad"
                    placeholder="+91 9876543210"
                  />
                </View>
              ))}
            </Card>
          </>
        )}

        {/* Actions */}
        <View style={{ marginTop: SPACE.lg }}>
          <Btn title="Save Profile Changes" onPress={save} loading={busy} />
          <Btn
            kind="ghost"
            title="Reset / Change Password"
            onPress={() => navigation.navigate('ForgotPassword')}
            icon={<Ionicons name="key-outline" size={17} color={C.ink2} />}
            style={{ marginTop: 10 }}
          />
          <Btn
            kind="ghost"
            title="Log Out of Account"
            onPress={logout}
            icon={<Ionicons name="log-out-outline" size={17} color={C.ink2} />}
            style={{ marginTop: 10 }}
          />
          <Btn
            kind="dangerGhost"
            title="Delete Account"
            onPress={confirmDeleteAccount}
            icon={<Ionicons name="trash-outline" size={16} color={C.sosInk} />}
            style={{ marginTop: 10 }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    padding: SPACE.md,
    marginBottom: SPACE.lg,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },
  userName: {
    fontSize: 17,
    fontWeight: '800',
    color: C.ink,
  },
  userEmail: {
    fontSize: 13,
    color: C.muted,
    marginTop: 2,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    marginTop: 6,
  },
  roleBadgeText: {
    fontWeight: '800',
    fontSize: 11,
  },
  socDivider: {
    height: 1,
    backgroundColor: C.lineLight,
    marginVertical: SPACE.md,
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: C.ink,
    marginBottom: SPACE.sm,
  },
  contactBlock: {
    marginBottom: SPACE.md,
    paddingBottom: SPACE.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.lineLight,
  },
  contactLabel: {
    fontWeight: '800',
    color: C.ink2,
    fontSize: 13,
    marginBottom: 6,
  },
});