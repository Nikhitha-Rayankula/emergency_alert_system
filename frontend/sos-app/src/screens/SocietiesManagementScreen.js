import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import ActionModal from '../components/ActionModal';
import { Card, Btn, Chip, Field, Empty, SkeletonList, C, SPACE, RADIUS, IdBadge, fmtSocId } from '../ui';
import { useAuth } from '../AuthContext';
import { useToast } from '../Toast';
import api, { errorText } from '../api';

export default function SocietiesManagementScreen({ navigation }) {
  const { user } = useAuth();
  const toast = useToast();

  const [societies, setSocieties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Add/Edit Society Modal
  const [addModal, setAddModal] = useState(false);
  const [editingSociety, setEditingSociety] = useState(null);
  const [socForm, setSocForm] = useState({ society_name: '', owner_name: '', incharge: '', sub_admin_username: '' });

  // Assign User to Society Modal
  const [assignModal, setAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ user_id: '', gated_society: '' });

  const [busy, setBusy] = useState(false);

  const loadSocieties = useCallback(async () => {
    try {
      const { data } = await api.get('/gated-society/').catch(() => ({ data: [] }));
      const list = Array.isArray(data) ? data : (data?.results || (data ? [data] : []));
      setSocieties(list);
    } catch (e) {
      console.log('Societies load error:', e.message);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadSocieties();
    }, [loadSocieties])
  );

  const handleSaveSociety = async () => {
    if (!socForm.society_name.trim() || !socForm.owner_name.trim() || !socForm.incharge.trim()) {
      Alert.alert('Required Fields', 'Please provide society name, owner, and incharge.');
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

      if (editingSociety?.id) {
        await api.patch(`/gated-society/${editingSociety.id}/edit/`, payload);
        toast(`Society ${editingSociety.society_name} (${fmtSocId(editingSociety.id)}) updated`, 'success');
      } else {
        const res = await api.post('/gated-society/add/', payload);
        const createdId = res.data?.id;
        toast(`Society created successfully: ${socForm.society_name} (${fmtSocId(createdId)})`, 'success');
      }

      setAddModal(false);
      setEditingSociety(null);
      setSocForm({ society_name: '', owner_name: '', incharge: '', sub_admin_username: '' });
      loadSocieties();
    } catch (e) {
      Alert.alert('Save Failed', errorText(e));
    }
    setBusy(false);
  };

  const handleDeleteSociety = (soc) => {
    Alert.alert(
      'Delete Society?',
      `Are you sure you want to delete ${soc.society_name} (${fmtSocId(soc.id)})? This will remove all associated blocks, flats, and records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/gated-society/${soc.id}/delete/`);
              toast(`Society ${fmtSocId(soc.id)} deleted`, 'success');
              loadSocieties();
            } catch (e) {
              Alert.alert('Delete Failed', errorText(e));
            }
          },
        },
      ]
    );
  };

  const handleAssignUser = async () => {
    if (!assignForm.user_id || !assignForm.gated_society) {
      Alert.alert('Required Fields', 'Please select or enter User ID and Society.');
      return;
    }

    setBusy(true);
    try {
      await api.post('/assign-society/', {
        user_id: Number(assignForm.user_id),
        gated_society: Number(assignForm.gated_society),
      });

      setAssignModal(false);
      setAssignForm({ user_id: '', gated_society: '' });
      toast('User assigned to society successfully', 'success');
    } catch (e) {
      Alert.alert('Assign Failed', errorText(e));
    }
    setBusy(false);
  };

  const openEdit = (soc) => {
    setEditingSociety(soc);
    setSocForm({
      society_name: soc.society_name || '',
      owner_name: soc.owner_name || '',
      incharge: soc.incharge || '',
      sub_admin_username: soc.sub_admin || '',
    });
    setAddModal(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header
        title="Gated Societies"
        subtitle="Manage registered communities & assignments"
        onRefresh={() => {
          setRefreshing(true);
          loadSocieties();
        }}
        right={
          <Btn
            title="+ Add"
            size="sm"
            kind="primary"
            onPress={() => {
              setEditingSociety(null);
              setSocForm({ society_name: '', owner_name: '', incharge: '', sub_admin_username: '' });
              setAddModal(true);
            }}
            icon={<Ionicons name="add" size={16} color="#fff" />}
          />
        }
      />

      <View style={styles.topActionsBar}>
        <Btn
          title="Assign User to Society"
          kind="soft"
          size="sm"
          onPress={() => setAssignModal(true)}
          icon={<Ionicons name="swap-horizontal" size={15} color={C.accentInk} />}
          style={{ flex: 1 }}
        />
      </View>

      <FlatList
        data={societies}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 40 }}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          loadSocieties();
        }}
        ListEmptyComponent={
          loading ? (
            <SkeletonList rows={3} />
          ) : (
            <Empty
              title="No Societies Registered"
              text="Tap '+ Add' in the top bar to provision a new gated community."
              icon={<Ionicons name="business-outline" size={32} color={C.accent} />}
            />
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.socCard}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={styles.socIconWrap}>
                <Ionicons name="business" size={22} color={C.purpleInk} />
              </View>

              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text style={styles.socName}>{item.society_name}</Text>
                  <IdBadge id={item.id} prefix="SOC" size="sm" />
                </View>
                <Text style={styles.socOwner}>Owner / Body: {item.owner_name}</Text>
                <Text style={styles.socIncharge}>Facility Incharge: {item.incharge}</Text>
                {item.sub_admin ? (
                  <View style={styles.subAdminRow}>
                    <Ionicons name="person-circle" size={14} color={C.accent} />
                    <Text style={styles.socSubAdmin}>Sub Admin: {item.sub_admin}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.cardActions}>
              <Btn
                title="Edit"
                kind="ghost"
                size="sm"
                onPress={() => openEdit(item)}
                icon={<Ionicons name="create-outline" size={14} color={C.ink} />}
                style={{ marginRight: 8 }}
              />
              <Btn
                title="Delete"
                kind="dangerGhost"
                size="sm"
                onPress={() => handleDeleteSociety(item)}
                icon={<Ionicons name="trash-outline" size={14} color={C.sosInk} />}
              />
            </View>
          </Card>
        )}
      />

      {/* Add / Edit Society Modal */}
      <ActionModal
        visible={addModal}
        onClose={() => setAddModal(false)}
        title={editingSociety ? `Edit Society (${fmtSocId(editingSociety.id)})` : 'Register Gated Society'}
        subtitle="Enter community details and administration incharge."
        submitText={editingSociety ? 'Save Changes' : 'Create Society'}
        loading={busy}
        onSubmit={handleSaveSociety}
      >
        {editingSociety && (
          <View style={styles.modalIdBadge}>
            <Text style={styles.modalIdLabel}>Society Identifier:</Text>
            <Text style={styles.modalIdVal}>{fmtSocId(editingSociety.id)} (Internal DB ID #{editingSociety.id})</Text>
          </View>
        )}
        <Field
          label="Society Name"
          value={socForm.society_name}
          onChangeText={(v) => setSocForm({ ...socForm, society_name: v })}
          placeholder="e.g. Green Valley Apartments"
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
          hint="Username of an existing Sub Admin to assign"
        />
      </ActionModal>

      {/* Assign User to Society Modal */}
      <ActionModal
        visible={assignModal}
        onClose={() => setAssignModal(false)}
        title="Assign User to Society"
        subtitle="Associate an existing resident or staff member with a gated society."
        submitText="Assign User"
        loading={busy}
        onSubmit={handleAssignUser}
      >
        <Field
          label="User ID (e.g. USR-012)"
          value={assignForm.user_id}
          onChangeText={(v) => setAssignForm({ ...assignForm, user_id: v.replace(/[^0-9]/g, '') })}
          placeholder="Enter numeric User ID (e.g. 12)"
          keyboardType="number-pad"
        />

        <Text style={styles.pickerLabel}>Select Society:</Text>
        {societies.length > 0 && (
          <View style={styles.chipGrid}>
            {societies.map((soc) => (
              <Chip
                key={soc.id}
                label={`${soc.society_name} (${fmtSocId(soc.id)})`}
                active={String(assignForm.gated_society) === String(soc.id)}
                onPress={() => setAssignForm({ ...assignForm, gated_society: String(soc.id) })}
              />
            ))}
          </View>
        )}

        <Field
          label="Or Enter Society ID directly"
          value={assignForm.gated_society}
          onChangeText={(v) => setAssignForm({ ...assignForm, gated_society: v.replace(/[^0-9]/g, '') })}
          placeholder="e.g. 6"
          keyboardType="number-pad"
        />
      </ActionModal>
    </View>
  );
}

const styles = StyleSheet.create({
  topActionsBar: {
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.xs,
  },
  socCard: {
    padding: SPACE.md,
    marginBottom: SPACE.md,
  },
  socIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socName: {
    fontSize: 16,
    fontWeight: '800',
    color: C.ink,
  },
  socOwner: {
    fontSize: 12.5,
    color: C.muted,
    marginTop: 2,
  },
  socIncharge: {
    fontSize: 12.5,
    color: C.ink3,
    marginTop: 1,
  },
  subAdminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  socSubAdmin: {
    fontSize: 12,
    color: C.accentInk,
    fontWeight: '700',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SPACE.sm,
    paddingTop: SPACE.sm,
    borderTopWidth: 1,
    borderTopColor: C.lineLight,
  },
  modalIdBadge: {
    backgroundColor: '#EFF6FF',
    padding: 10,
    borderRadius: RADIUS.sm,
    marginBottom: SPACE.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  modalIdLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: C.accent,
    textTransform: 'uppercase',
  },
  modalIdVal: {
    fontSize: 13,
    fontWeight: '700',
    color: C.ink,
    marginTop: 2,
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.ink2,
    marginBottom: 6,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: SPACE.md,
  },
});
