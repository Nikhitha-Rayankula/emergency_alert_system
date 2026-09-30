import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Switch, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, Btn, Field, C, SPACE, RADIUS } from '../ui';
import { useToast } from '../Toast';
import api, { errorText } from '../api';

export default function EscalationConfigScreen({ navigation }) {
  const toast = useToast();

  const [timeoutSecs, setTimeoutSecs] = useState('60');
  const [primaryGuardian, setPrimaryGuardian] = useState(true);
  const [secondaryGuardian, setSecondaryGuardian] = useState(true);
  const [emergencyContacts, setEmergencyContacts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/escalation/config/');
      setTimeoutSecs(String(data.response_timeout_seconds || 60));
      setPrimaryGuardian(data.primary_guardian_enabled ?? true);
      setSecondaryGuardian(data.secondary_guardian_enabled ?? true);
      setEmergencyContacts(data.emergency_contact_enabled ?? true);
    } catch (e) {
      console.log('Escalation config load note:', e.message);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConfig();
    }, [loadConfig])
  );

  const saveConfig = async () => {
    setBusy(true);
    try {
      await api.patch('/escalation/config/', {
        response_timeout_seconds: Number(timeoutSecs) || 60,
        primary_guardian_enabled: primaryGuardian,
        secondary_guardian_enabled: secondaryGuardian,
        emergency_contact_enabled: emergencyContacts,
      });

      toast('Escalation rules updated successfully', 'success');
    } catch (e) {
      Alert.alert('Save Failed', errorText(e));
    }
    setBusy(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header
        title="Escalation Rules"
        subtitle="Configure automatic emergency cascade timing & tiers"
        onRefresh={loadConfig}
      />

      <ScrollView contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 40 }}>
        {/* Timing Configuration Card */}
        <Card style={styles.configCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={[styles.iconWrap, { backgroundColor: C.accentSoft }]}>
              <Ionicons name="timer" size={22} color={C.accent} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cardTitle}>Response Timeout</Text>
              <Text style={styles.cardSub}>
                Seconds to wait before escalating unaccepted SOS to the next responder group.
              </Text>
            </View>
          </View>

          <Field
            label="Stage Timeout (Seconds)"
            value={timeoutSecs}
            onChangeText={setTimeoutSecs}
            keyboardType="number-pad"
            placeholder="60"
            hint="Recommended: 45 - 90 seconds"
          />
        </Card>

        {/* Escalation Cascade Stages */}
        <Text style={styles.sectionTitle}>Escalation Notification Tiers</Text>

        {/* Tier 1 */}
        <Card style={styles.tierCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.stageBadge, { backgroundColor: C.accentSoft }]}>
                  <Text style={[styles.stageBadgeText, { color: C.accentInk }]}>STAGE 1</Text>
                </View>
                <Text style={styles.tierTitle}>Primary Flat Guardian</Text>
              </View>
              <Text style={styles.tierSub}>
                Notifies the designated guardian of the resident's flat immediately upon SOS trigger.
              </Text>
            </View>
            <Switch
              value={primaryGuardian}
              onValueChange={setPrimaryGuardian}
              trackColor={{ false: '#CBD5E1', true: C.safe }}
            />
          </View>
        </Card>

        {/* Tier 2 */}
        <Card style={styles.tierCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.stageBadge, { backgroundColor: C.warnSoft }]}>
                  <Text style={[styles.stageBadgeText, { color: C.warnInk }]}>STAGE 2-3</Text>
                </View>
                <Text style={styles.tierTitle}>Security & Volunteers</Text>
              </View>
              <Text style={styles.tierSub}>
                Alerts on-duty gate security and nearby community volunteers to rush on-site.
              </Text>
            </View>
            <View style={[styles.activePill, { backgroundColor: C.safeSoft }]}>
              <Text style={[styles.activePillText, { color: C.safeInk }]}>ALWAYS ACTIVE</Text>
            </View>
          </View>
        </Card>

        {/* Tier 3 */}
        <Card style={styles.tierCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.stageBadge, { backgroundColor: C.purpleSoft }]}>
                  <Text style={[styles.stageBadgeText, { color: C.purpleInk }]}>STAGE 5</Text>
                </View>
                <Text style={styles.tierTitle}>Secondary Guardian</Text>
              </View>
              <Text style={styles.tierSub}>
                Alerts backup flat guardian if primary responders are occupied.
              </Text>
            </View>
            <Switch
              value={secondaryGuardian}
              onValueChange={setSecondaryGuardian}
              trackColor={{ false: '#CBD5E1', true: C.safe }}
            />
          </View>
        </Card>

        {/* Tier 4 */}
        <Card style={styles.tierCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={[styles.stageBadge, { backgroundColor: C.sosSoft }]}>
                  <Text style={[styles.stageBadgeText, { color: C.sosInk }]}>STAGE 6</Text>
                </View>
                <Text style={styles.tierTitle}>Emergency SMS Broadcast</Text>
              </View>
              <Text style={styles.tierSub}>
                Sends SMS with live GPS link to resident's 3 emergency phone contacts.
              </Text>
            </View>
            <Switch
              value={emergencyContacts}
              onValueChange={setEmergencyContacts}
              trackColor={{ false: '#CBD5E1', true: C.safe }}
            />
          </View>
        </Card>

        {/* Save Button */}
        <Btn
          title="Save Escalation Policy"
          loading={busy}
          onPress={saveConfig}
          icon={<Ionicons name="save" size={17} color="#fff" />}
          style={{ marginTop: SPACE.lg }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  configCard: {
    padding: SPACE.lg,
    marginBottom: SPACE.xl,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.ink,
  },
  cardSub: {
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: C.ink,
    marginBottom: SPACE.sm,
  },
  tierCard: {
    padding: SPACE.md,
    marginBottom: SPACE.sm,
  },
  stageBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    marginRight: 8,
  },
  stageBadgeText: {
    fontWeight: '800',
    fontSize: 10,
  },
  tierTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: C.ink,
  },
  tierSub: {
    fontSize: 12,
    color: C.muted,
    marginTop: 4,
  },
  activePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  activePillText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
});
