import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, Btn, Field, C, SPACE, RADIUS } from '../ui';
import { useAuth } from '../AuthContext';
import { useToast } from '../Toast';
import api, { errorText } from '../api';

const blankContact = (c) => ({
  name: c?.name || '',
  phone_number: c?.phone_number || '',
});

export default function ResidentContactsScreen({ navigation }) {
  const { user, refreshUser } = useAuth();
  const toast = useToast();

  const [contacts, setContacts] = useState([
    blankContact(user?.emergency_contact1),
    blankContact(user?.emergency_contact2),
    blankContact(user?.emergency_contact3),
  ]);

  const [societyInfo, setSocietyInfo] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  // Load society info
  const loadSociety = useCallback(async () => {
    try {
      const { data } = await api.get('/gated-society/mine/');
      setSocietyInfo(data);
    } catch (e) {
      // Ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSociety();
    }, [loadSociety])
  );

  const setContactField = (index, field, value) => {
    setContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );
  };

  const saveContacts = async () => {
    setBusy(true);
    try {
      const payload = {
        emergency_contact1: contacts[0].name || contacts[0].phone_number ? contacts[0] : null,
        emergency_contact2: contacts[1].name || contacts[1].phone_number ? contacts[1] : null,
        emergency_contact3: contacts[2].name || contacts[2].phone_number ? contacts[2] : null,
      };

      await api.patch('/profile/update/', payload);
      await refreshUser();
      setIsEditing(false);
      toast('Emergency contacts updated successfully!', 'success');
    } catch (e) {
      Alert.alert('Save Failed', errorText(e));
    }
    setBusy(false);
  };

  const callPhone = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header title="Safety Contacts" subtitle="Guardians, family & emergency phone numbers" />

      <ScrollView contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 40 }}>
        {/* Flat Guardian Info Card */}
        <Card style={styles.guardianCard}>
          <View style={styles.guardianHeader}>
            <View style={styles.guardianIcon}>
              <Ionicons name="shield-checkmark" size={22} color={C.safeDark} />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.guardianTitle}>Flat & Society Guardian</Text>
              <Text style={styles.guardianSub}>
                {societyInfo ? `${societyInfo.society_name} • Incharge: ${societyInfo.incharge}` : 'Assigned community protection'}
              </Text>
            </View>
          </View>

          <View style={styles.guardianDetailBox}>
            <Text style={{ fontSize: 13, color: C.ink3 }}>
              When you raise an SOS, your primary guardian and society security are notified first.
            </Text>
          </View>
        </Card>

        {/* Emergency Contacts Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Family & Emergency Contacts</Text>
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
            <Text style={styles.editToggleText}>{isEditing ? 'Cancel' : 'Edit Contacts'}</Text>
          </TouchableOpacity>
        </View>

        {isEditing ? (
          <Card>
            <Text style={{ color: C.muted, fontSize: 12.5, marginBottom: 12 }}>
              These contacts will receive automatic SMS alerts with your GPS location if an SOS escalates.
            </Text>

            {contacts.map((c, i) => (
              <View key={i} style={styles.contactEditBlock}>
                <Text style={styles.contactBlockLabel}>Emergency Contact #{i + 1}</Text>
                <Field
                  label="Contact Name / Relation"
                  value={c.name}
                  onChangeText={(val) => setContactField(i, 'name', val)}
                  placeholder="e.g. Mom, Brother, Doctor"
                  autoCapitalize="words"
                />
                <Field
                  label="Phone Number"
                  value={c.phone_number}
                  onChangeText={(val) => setContactField(i, 'phone_number', val)}
                  placeholder="+91 9876543210"
                  keyboardType="phone-pad"
                />
              </View>
            ))}

            <Btn
              title="Save Emergency Contacts"
              loading={busy}
              onPress={saveContacts}
              style={{ marginTop: 8 }}
            />
          </Card>
        ) : (
          contacts.map((c, i) => {
            const hasData = c.name || c.phone_number;
            return (
              <Card key={i} style={styles.contactCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={styles.contactInfo}>
                    <View style={styles.contactAvatar}>
                      <Text style={styles.contactAvatarText}>#{i + 1}</Text>
                    </View>
                    <View style={{ marginLeft: 10 }}>
                      <Text style={styles.contactName}>{c.name || `Emergency Contact ${i + 1}`}</Text>
                      <Text style={styles.contactPhone}>{c.phone_number || 'Not configured yet'}</Text>
                    </View>
                  </View>

                  {c.phone_number ? (
                    <TouchableOpacity
                      style={styles.callBtn}
                      onPress={() => callPhone(c.phone_number)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="call" size={18} color="#fff" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={() => setIsEditing(true)}>
                      <Text style={styles.addContactText}>+ Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  guardianCard: {
    backgroundColor: C.safeSoft,
    borderColor: C.safe + '40',
    borderWidth: 1.5,
    marginBottom: SPACE.xl,
  },
  guardianHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guardianIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guardianTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.safeInk,
  },
  guardianSub: {
    fontSize: 12.5,
    color: C.safeDark,
    marginTop: 2,
  },
  guardianDetailBox: {
    marginTop: SPACE.md,
    paddingTop: SPACE.sm,
    borderTopWidth: 1,
    borderTopColor: C.safe + '33',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACE.md,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
  },
  editToggleText: {
    color: C.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  contactCard: {
    padding: SPACE.md,
    marginBottom: SPACE.md,
  },
  contactInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: {
    fontWeight: '800',
    color: C.accentInk,
    fontSize: 13,
  },
  contactName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: C.ink,
  },
  contactPhone: {
    fontSize: 12.5,
    color: C.muted,
    marginTop: 2,
  },
  callBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.safe,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.safe,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  addContactText: {
    color: C.accent,
    fontWeight: '800',
    fontSize: 13,
  },
  contactEditBlock: {
    marginBottom: SPACE.lg,
    paddingBottom: SPACE.md,
    borderBottomWidth: 1,
    borderBottomColor: C.lineLight,
  },
  contactBlockLabel: {
    fontWeight: '800',
    color: C.ink2,
    marginBottom: 8,
    fontSize: 13.5,
  },
});
