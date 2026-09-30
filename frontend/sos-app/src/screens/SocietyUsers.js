import React, { useState, useCallback } from 'react';
import { FlatList, Text, View, Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import ActionModal from '../components/ActionModal';
import { Card, Btn, Chip, Field, Empty, SkeletonList, C, SPACE, RADIUS } from '../ui';
import { useAuth } from '../AuthContext';
import api, { errorText } from '../api';
import { useToast } from '../Toast';

const ROLES_FILTER = ['All', 'Resident', 'Guardian', 'Volunteer', 'Security', 'Sub Admin', 'Admin'];

export default function SocietyUsers() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.group_name === 'Admin';
  const isSubAdmin = user?.group_name === 'Sub Admin';

  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('All');
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Invite Modal
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteRole, setInviteRole] = useState(isAdmin ? 'Sub Admin' : 'Volunteer');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFlat, setInviteFlat] = useState('');
  const [inviteSociety, setInviteSociety] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/society/users/');
      setItems(data || []);
    } catch (e) {
      Alert.alert('Could Not Load Users', errorText(e));
    }
    setLoaded(true);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const removeUser = (u) => {
    Alert.alert(
      'Remove Member?',
      `Are you sure you want to permanently remove ${u.username} (${u.group_name})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isAdmin) {
                await api.delete(`/admin/users/${u.id}/delete/`);
              } else {
                await api.delete(`/society/users/${u.id}/delete/`);
              }
              await load();
              toast(`${u.username} removed successfully`, 'success');
            } catch (e) {
              Alert.alert('Delete Failed', errorText(e));
            }
          },
        },
      ]
    );
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Email Required', 'Please enter a valid email address.');
      return;
    }

    setBusy(true);
    try {
      if (inviteRole === 'Volunteer') {
        await api.post('/invite/volunteer/', { email: inviteEmail.trim() });
      } else if (inviteRole === 'Security') {
        await api.post('/invite/security/', { email: inviteEmail.trim() });
      } else if (inviteRole === 'Guardian') {
        if (!inviteFlat) {
          Alert.alert('Flat Required', 'Please enter the Flat ID for this guardian.');
          setBusy(false);
          return;
        }
        await api.post('/invite/guardian/', { email: inviteEmail.trim(), flat: Number(inviteFlat) });
      } else if (inviteRole === 'Sub Admin') {
        if (!inviteSociety) {
          Alert.alert('Society Required', 'Please enter the Society ID.');
          setBusy(false);
          return;
        }
        await api.post('/invite/subadmin/', { email: inviteEmail.trim(), gated_society: Number(inviteSociety) });
      } else if (inviteRole === 'Admin') {
        await api.post('/invite/admin/', { email: inviteEmail.trim() });
      }

      setInviteModal(false);
      setInviteEmail('');
      setInviteFlat('');
      setInviteSociety('');
      toast(`Invite sent to ${inviteEmail}`, 'success');
      load();
    } catch (e) {
      Alert.alert('Invite Failed', errorText(e));
    }
    setBusy(false);
  };

  const filteredUsers = items.filter((u) => {
    if (filter === 'All') return true;
    return u.group_name === filter;
  });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header
        title="Member Directory"
        subtitle={`${items.length} registered accounts`}
        onRefresh={() => {
          setRefreshing(true);
          load();
        }}
        right={
          (isAdmin || isSubAdmin) && (
            <Btn
              title="+ Invite"
              small
              kind="primary"
              onPress={() => setInviteModal(true)}
              icon={<Ionicons name="mail" size={14} color="#fff" />}
            />
          )
        }
      />

      {/* Role Filter Chips */}
      <View style={styles.filterScroll}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={ROLES_FILTER}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingVertical: 4 }}
          renderItem={({ item }) => (
            <Chip
              label={item}
              active={filter === item}
              onPress={() => setFilter(item)}
            />
          )}
        />
      </View>

      <FlatList
        data={filteredUsers}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 40 }}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          load();
        }}
        ListEmptyComponent={
          !loaded ? (
            <SkeletonList rows={3} />
          ) : (
            <Empty
              title="No Users Found"
              text={
                filter === 'All'
                  ? 'No members registered in this society yet. Use the Invite button to invite team members.'
                  : `No members found under role "${filter}".`
              }
              icon={<Ionicons name="people-outline" size={32} color={C.accent} />}
            />
          )
        }
        renderItem={({ item }) => {
          const isCurrentUser = item.id === user?.id;
          return (
            <Card style={styles.userCard}>
              <View style={styles.userRow}>
                <View style={styles.avatarWrap}>
                  <Text style={styles.avatarText}>
                    {(item.username || 'U').substring(0, 2).toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.userName}>{item.username}</Text>
                    {isCurrentUser && (
                      <View style={styles.youBadge}>
                        <Text style={styles.youBadgeText}>YOU</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.userEmail}>{item.email}</Text>
                  {item.mobile ? <Text style={styles.userPhone}>{item.mobile}</Text> : null}
                </View>

                <View style={[styles.rolePill, { backgroundColor: C.accentSoft }]}>
                  <Text style={[styles.rolePillText, { color: C.accentInk }]}>
                    {item.group_name || 'Member'}
                  </Text>
                </View>
              </View>

              {/* Admin delete action */}
              {(isSubAdmin || isAdmin) && !isCurrentUser && (
                <View style={styles.cardActions}>
                  <Btn
                    kind="dangerGhost"
                    title="Remove Member"
                    small
                    onPress={() => removeUser(item)}
                    icon={<Ionicons name="trash-outline" size={14} color={C.sosInk} />}
                  />
                </View>
              )}
            </Card>
          );
        }}
      />

      {/* Invite Member Modal */}
      <ActionModal
        visible={inviteModal}
        onClose={() => setInviteModal(false)}
        title="Invite New Member"
        subtitle="Send an official email registration invitation."
        submitText="Send Invitation"
        loading={busy}
        onSubmit={sendInvite}
      >
        <Text style={styles.modalLabel}>Role to Assign:</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 14 }}>
          {(isAdmin
            ? ['Volunteer', 'Security', 'Guardian', 'Sub Admin', 'Admin']
            : ['Volunteer', 'Security', 'Guardian']
          ).map((r) => (
            <Chip
              key={r}
              label={r}
              active={inviteRole === r}
              onPress={() => setInviteRole(r)}
            />
          ))}
        </View>

        <Field
          label="Email Address"
          value={inviteEmail}
          onChangeText={setInviteEmail}
          placeholder="member@example.com"
          keyboardType="email-address"
        />

        {inviteRole === 'Guardian' && (
          <Field
            label="Flat ID"
            value={inviteFlat}
            onChangeText={setInviteFlat}
            placeholder="e.g. 1"
            keyboardType="number-pad"
            hint="The Flat ID this guardian will manage"
          />
        )}

        {inviteRole === 'Sub Admin' && (
          <Field
            label="Society ID"
            value={inviteSociety}
            onChangeText={setInviteSociety}
            placeholder="e.g. 1"
            keyboardType="number-pad"
            hint="The Gated Society ID this admin will manage"
          />
        )}
      </ActionModal>
    </View>
  );
}

const styles = StyleSheet.create({
  filterScroll: {
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.lineLight,
  },
  userCard: {
    padding: SPACE.md,
    marginBottom: SPACE.sm,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
  },
  youBadge: {
    backgroundColor: C.safeSoft,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.pill,
    marginLeft: 6,
  },
  youBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: C.safeInk,
  },
  userEmail: {
    fontSize: 12.5,
    color: C.muted,
    marginTop: 2,
  },
  userPhone: {
    fontSize: 11.5,
    color: C.ink3,
    marginTop: 2,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  rolePillText: {
    fontWeight: '800',
    fontSize: 11,
  },
  cardActions: {
    marginTop: SPACE.sm,
    paddingTop: SPACE.sm,
    borderTopWidth: 1,
    borderTopColor: C.lineLight,
    alignItems: 'flex-end',
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: C.ink2,
    marginBottom: 8,
  },
});