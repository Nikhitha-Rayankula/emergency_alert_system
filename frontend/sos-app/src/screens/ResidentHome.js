import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Header from '../components/Header';
import IncidentCard from '../components/IncidentCard';
import { Card, Btn, Chip, Field, StatusBadge, CategoryBadge, CATEGORIES, C, SPACE, RADIUS, SHADOW, fmt, getUserDisplayName } from '../ui';
import { useAuth } from '../AuthContext';
import { useToast } from '../Toast';
import api, { errorText } from '../api';
import { getPosition } from '../location';

export default function ResidentHome({ navigation }) {
  const { user } = useAuth();
  const toast = useToast();

  const [category, setCategory] = useState('medical');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeIncident, setActiveIncident] = useState(null);
  const [recentIncidents, setRecentIncidents] = useState([]);
  const [currentGps, setCurrentGps] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Pulse animation for the SOS button
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          duration: 1200,
          toValue: 1,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Load active and recent incidents
  const loadIncidents = useCallback(async () => {
    try {
      const { data } = await api.get('/sos/mine/');
      const ongoing = data.find((i) => ['open', 'escalated', 'active_response'].includes(i.status)) || null;
      setActiveIncident(ongoing);
      setRecentIncidents(data.slice(0, 3));
    } catch (e) {
      // Ignore
    }
  }, []);

  // Fetch current GPS position on screen focus
  const loadLocation = useCallback(async () => {
    setGpsLoading(true);
    try {
      const pos = await getPosition();
      setCurrentGps(pos);
    } catch (e) {
      console.log('GPS preload error:', e.message);
    }
    setGpsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadIncidents();
      loadLocation();
      const interval = setInterval(loadIncidents, 6000);
      return () => clearInterval(interval);
    }, [loadIncidents, loadLocation])
  );

  const triggerSOS = async () => {
    setBusy(true);
    try {
      const pos = await getPosition();
      const payload = {
        category,
        message: message.trim(),
        latitude: pos.latitude,
        longitude: pos.longitude,
      };

      const { data } = await api.post('/sos/trigger/', payload);
      setMessage('');
      toast('SOS Alert Broadcasted! Guardians & Responders Notified.', 'error');
      loadIncidents();
      navigation.navigate('IncidentDetail', { id: data.id });
    } catch (e) {
      Alert.alert('Could Not Send SOS', errorText(e));
    }
    setBusy(false);
  };

  const confirmSOS = () => {
    const selectedCat = CATEGORIES.find((c) => c.key === category)?.label || 'Emergency';
    Alert.alert(
      `🚨 Trigger ${selectedCat}?`,
      `Your exact GPS location will be broadcasted to your guardian, security staff, and community volunteers immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'SEND SOS NOW', style: 'destructive', onPress: triggerSOS },
      ]
    );
  };

  const displayName = getUserDisplayName(user);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header
        title={`Hello, ${displayName} 👋`}
        subtitle={user?.gated_society ? `Society #${user.gated_society}` : 'Ready for emergency response'}
        onRefresh={loadIncidents}
      />

      <ScrollView
        contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Active Emergency Tracker Banner */}
        {activeIncident && (
          <Card
            onPress={() => navigation.navigate('IncidentDetail', { id: activeIncident.id })}
            style={styles.activeBanner}
          >
            <View style={styles.activeTopRow}>
              <View style={styles.activeBadge}>
                <View style={styles.pulsingRedDot} />
                <Text style={styles.activeBadgeText}>ACTIVE EMERGENCY SOS</Text>
              </View>
              <StatusBadge status={activeIncident.status} small />
            </View>

            <Text style={styles.activeCategory}>
              {CATEGORIES.find((c) => c.key === activeIncident.category)?.label || 'Emergency'}
            </Text>
            {activeIncident.message ? (
              <Text style={styles.activeMessage} numberOfLines={2}>
                "{activeIncident.message}"
              </Text>
            ) : null}

            <View style={styles.activeActionRow}>
              <Text style={styles.activeTrackText}>Tap to View Live Responder Map & Chat</Text>
              <Ionicons name="chevron-forward" size={16} color={C.sosInk} />
            </View>
          </Card>
        )}

        {/* Emergency Category Selector */}
        <Text style={styles.sectionTitle}>1. Select Emergency Type</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => {
            const isSelected = category === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                activeOpacity={0.8}
                onPress={() => setCategory(cat.key)}
                style={[
                  styles.categoryCard,
                  isSelected && {
                    borderColor: cat.color,
                    backgroundColor: cat.bg,
                    ...SHADOW.card,
                  },
                ]}
              >
                <View
                  style={[
                    styles.catIconWrap,
                    { backgroundColor: isSelected ? cat.color : '#F1F5F9' },
                  ]}
                >
                  {cat.iconSet === 'mci' ? (
                    <MaterialCommunityIcons
                      name={cat.icon}
                      size={24}
                      color={isSelected ? '#fff' : C.muted}
                    />
                  ) : (
                    <Ionicons
                      name={cat.icon}
                      size={24}
                      color={isSelected ? '#fff' : C.muted}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.catTitle,
                    isSelected && { color: cat.color, fontWeight: '800' },
                  ]}
                >
                  {cat.short}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Optional Message Field */}
        <Text style={[styles.sectionTitle, { marginTop: SPACE.lg }]}>2. Additional Notes (Optional)</Text>
        <Field
          value={message}
          onChangeText={setMessage}
          placeholder="e.g. Need medical help in Flat 204, severe chest pain..."
          multiline
          numberOfLines={2}
          style={{ marginBottom: SPACE.lg }}
        />

        {/* Giant Pulsing SOS Button */}
        <View style={styles.sosContainer}>
          <Animated.View
            style={[
              styles.sosPulseRing,
              { transform: [{ scale: pulseAnim }] },
            ]}
          />

          <TouchableOpacity
            disabled={busy}
            onPress={confirmSOS}
            activeOpacity={0.88}
            style={[
              styles.sosButton,
              busy && { opacity: 0.7 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="large" />
            ) : (
              <>
                <Text style={styles.sosText}>SOS</Text>
                <Text style={styles.sosSubText}>TAP TO CALL HELP</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* GPS Live Status Pill */}
        <View style={styles.gpsStatusPill}>
          <Ionicons
            name={currentGps ? 'location' : 'location-outline'}
            size={14}
            color={currentGps ? C.safeDark : C.warnDark}
          />
          <Text style={styles.gpsStatusText}>
            {gpsLoading
              ? 'Acquiring GPS coordinates...'
              : currentGps
              ? `GPS Ready (${currentGps.latitude}, ${currentGps.longitude})`
              : 'GPS will be captured automatically on press'}
          </Text>
        </View>

        {/* Quick Resident Services */}
        <Text style={[styles.sectionTitle, { marginTop: SPACE.xxl }]}>Quick Access</Text>
        <View style={styles.quickGrid}>
          <Card
            onPress={() => navigation.navigate('Contacts')}
            style={styles.quickCard}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: C.safeSoft }]}>
              <Ionicons name="call" size={20} color={C.safeDark} />
            </View>
            <Text style={styles.quickTitle}>Emergency Contacts</Text>
            <Text style={styles.quickSub}>Guardians & Family</Text>
          </Card>

          <Card
            onPress={() => navigation.navigate('Incidents')}
            style={styles.quickCard}
          >
            <View style={[styles.quickIconWrap, { backgroundColor: C.accentSoft }]}>
              <Ionicons name="time" size={20} color={C.accent} />
            </View>
            <Text style={styles.quickTitle}>My Incident Log</Text>
            <Text style={styles.quickSub}>Previous SOS History</Text>
          </Card>
        </View>

        {/* Recent Incidents List Preview */}
        {recentIncidents.length > 0 && (
          <View style={{ marginTop: SPACE.lg }}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Recent Incidents</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Incidents')}>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </View>

            {recentIncidents.map((inc) => (
              <IncidentCard
                key={inc.id}
                incident={inc}
                onPress={() => navigation.navigate('IncidentDetail', { id: inc.id })}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  activeBanner: {
    backgroundColor: C.sosSoft,
    borderColor: C.sos,
    borderWidth: 1.5,
    marginBottom: SPACE.lg,
  },
  activeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pulsingRedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.sos,
    marginRight: 6,
  },
  activeBadgeText: {
    color: C.sosInk,
    fontWeight: '800',
    fontSize: 12,
  },
  activeCategory: {
    fontSize: 18,
    fontWeight: '800',
    color: C.ink,
    marginTop: 6,
  },
  activeMessage: {
    color: C.ink2,
    fontSize: 13,
    marginTop: 4,
    fontStyle: 'italic',
  },
  activeActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.sos + '33',
  },
  activeTrackText: {
    color: C.sosInk,
    fontWeight: '700',
    fontSize: 12.5,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: C.ink2,
    marginBottom: SPACE.sm,
    letterSpacing: -0.2,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: C.line,
    borderRadius: RADIUS.lg,
    padding: SPACE.md,
    alignItems: 'center',
  },
  catIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  catTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: C.ink,
    textAlign: 'center',
  },
  sosContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACE.xl,
    position: 'relative',
    height: 220,
  },
  sosPulseRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
  },
  sosButton: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: C.sos,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.sos,
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  sosText: {
    color: '#FFFFFF',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 1,
  },
  sosSubText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  gpsStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: SPACE.md,
  },
  gpsStatusText: {
    fontSize: 11.5,
    color: C.muted,
    fontWeight: '600',
    marginLeft: 6,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickCard: {
    flex: 1,
    padding: SPACE.md,
    alignItems: 'flex-start',
  },
  quickIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: C.ink,
  },
  quickSub: {
    fontSize: 11.5,
    color: C.muted,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACE.sm,
  },
  viewAllText: {
    color: C.accent,
    fontWeight: '700',
    fontSize: 13,
  },
});