import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import api, { errorText } from '../api';
import { useAuth } from '../AuthContext';
import { useToast } from '../Toast';
import { getPosition } from '../location';
import { getOSRMRoute, haversineKm, formatDistance } from '../services/routing';
import OSMMapView from '../components/OSMMapView';
import ActionModal from '../components/ActionModal';
import {
  Card,
  Btn,
  Chip,
  StatusBadge,
  CategoryBadge,
  Empty,
  IdBadge,
  C,
  SPACE,
  RADIUS,
  fmt,
  fmtSosId,
  fmtSocId,
  fmtBlkId,
  fmtFltId,
  fmtUsrId,
  getCategoryMeta,
} from '../ui';

const niceAction = (a) => {
  if (!a) return 'Action Logged';
  return a
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
};

export default function IncidentDetail({ route, navigation }) {
  const { id } = route.params;
  const { user } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const role = user?.group_name || 'Resident';
  const isResident = role === 'Resident';
  const isResponder = !isResident;
  const isAdminOrSub = ['Sub Admin', 'Admin'].includes(role);

  const listRef = useRef(null);

  const [activeTab, setActiveTab] = useState('map'); // 'map', 'details', 'timeline', 'chat'
  const [sos, setSos] = useState(null);
  const [history, setHistory] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const [chatText, setChatText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // GPS & Route State
  const [myLocation, setMyLocation] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);
  const [routingLoading, setRoutingLoading] = useState(false);

  // Modals
  const [resolveModal, setResolveModal] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [closeModal, setCloseModal] = useState(false);
  const [closeNote, setCloseNote] = useState('');
  const [escalateModal, setEscalateModal] = useState(false);
  const [escalateReason, setEscalateReason] = useState('');

  // Load Incident Data
  const load = useCallback(async () => {
    try {
      const [sosRes, histRes, chatRes] = await Promise.all([
        api.get(`/sos/${id}/`),
        api.get(`/sos/${id}/history/`).catch(() => ({ data: [] })),
        api.get(`/incidents/${id}/chat/messages/`).catch(() => ({ data: [] })),
      ]);
      setSos(sosRes.data);
      setHistory(histRes.data || []);
      setMsgs(chatRes.data || []);
      setErr('');
    } catch (e) {
      setErr(errorText(e));
    }
  }, [id]);

  // Capture current responder location and fetch OSRM route
  const updateRouteAndLocation = useCallback(async (emergencyData) => {
    if (!emergencyData || !emergencyData.latitude || !emergencyData.longitude) return;

    try {
      setRoutingLoading(true);
      const pos = await getPosition();
      setMyLocation(pos);

      // Sync responder GPS to backend
      api.patch('/users/me/location/', pos).catch(() => {});

      // Calculate OpenStreetMap OSRM Route
      const routeResult = await getOSRMRoute(
        pos.latitude,
        pos.longitude,
        emergencyData.latitude,
        emergencyData.longitude
      );

      if (routeResult) {
        setRouteInfo(routeResult);
      }
    } catch (e) {
      console.log('Location/Routing update note:', e.message);
    } finally {
      setRoutingLoading(false);
    }
  }, []);

  // Poll for updates every 4 seconds
  useFocusEffect(
    useCallback(() => {
      load();
      const interval = setInterval(load, 4000);
      return () => clearInterval(interval);
    }, [load])
  );

  // When sos data is loaded/updated, compute route
  useEffect(() => {
    if (sos && !myLocation) {
      updateRouteAndLocation(sos);
    }
  }, [sos, updateRouteAndLocation, myLocation]);

  // Actions
  const handleAccept = async () => {
    setBusy(true);
    try {
      await api.patch(`/sos/${id}/accept/`, {});
      toast('Emergency Accepted! Opening Navigation...', 'success');
      setActiveTab('map');
      await load();
      if (sos) updateRouteAndLocation(sos);
    } catch (e) {
      Alert.alert('Could not accept', errorText(e));
    }
    setBusy(false);
  };

  const handleDecline = () => {
    Alert.alert(
      'Decline Emergency?',
      'Are you sure you cannot respond to this incident?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await api.patch(`/incidents/${id}/reject/`, { reason: 'Responder unavailable' });
              toast('Incident marked as declined', 'info');
              await load();
            } catch (e) {
              Alert.alert('Error', errorText(e));
            }
            setBusy(false);
          },
        },
      ]
    );
  };

  const handleResolve = async () => {
    if (!resolveNote.trim()) {
      Alert.alert('Resolution Note Required', 'Please enter a brief note describing what assistance was provided.');
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/sos/${id}/resolve/`, { resolution: resolveNote.trim() });
      setResolveModal(false);
      setResolveNote('');
      toast('Incident marked as Resolved', 'success');
      await load();
    } catch (e) {
      Alert.alert('Error resolving incident', errorText(e));
    }
    setBusy(false);
  };

  const handleClose = async () => {
    setBusy(true);
    try {
      await api.patch(`/sos/${id}/close/`, { closure_note: closeNote.trim() || 'Closed by administrator' });
      setCloseModal(false);
      setCloseNote('');
      toast('Incident officially Closed', 'success');
      await load();
    } catch (e) {
      Alert.alert('Error closing incident', errorText(e));
    }
    setBusy(false);
  };

  const handleEscalate = async () => {
    if (!escalateReason.trim()) {
      Alert.alert('Reason Required', 'Please enter a reason for escalating this emergency.');
      return;
    }
    setBusy(true);
    try {
      await api.patch(`/incidents/${id}/escalate/`, { reason: escalateReason.trim() });
      setEscalateModal(false);
      setEscalateReason('');
      toast('Incident Escalated & Contacts Notified', 'error');
      await load();
    } catch (e) {
      Alert.alert('Error escalating', errorText(e));
    }
    setBusy(false);
  };

  const sendChatMessage = async () => {
    const text = chatText.trim();
    if (!text) return;
    setChatText('');
    try {
      await api.post(`/incidents/${id}/chat/messages/`, { message: text });
      load();
    } catch (e) {
      setChatText(text);
      Alert.alert('Failed to send', errorText(e));
    }
  };

  if (!sos) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={C.sos} />
        <Text style={{ color: C.muted, marginTop: 12, fontWeight: '600' }}>
          {err || 'Loading incident details & location...'}
        </Text>
      </View>
    );
  }

  const categoryMeta = getCategoryMeta(sos.category);
  const isPending = ['open', 'escalated'].includes(sos.status);
  const isResponding = sos.status === 'active_response';
  const isResolved = sos.status === 'resolved';
  const isClosed = ['closed', 'cancelled'].includes(sos.status);

  const canAccept = isResponder && isPending;
  const canResolve = isResponder && (isResponding || isPending);
  const canClose = isAdminOrSub && (isResolved || isResponding || isPending);
  const canEscalate = isResponder && (isPending || isResponding);

  const directDistance =
    myLocation && sos.latitude && sos.longitude
      ? formatDistance(haversineKm(myLocation.latitude, myLocation.longitude, sos.latitude, sos.longitude), true)
      : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={88}
    >
      {/* Top Incident Summary Bar */}
      <View style={styles.topSummaryBar}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <CategoryBadge category={sos.category} small />
            <StatusBadge status={sos.status} small />
            <IdBadge id={sos.id} prefix="SOS" size="sm" />
          </View>
          <Text style={styles.residentTitle} numberOfLines={1}>
            {sos.user ? `Emergency for ${sos.user}` : 'Emergency Incident'}
          </Text>
        </View>

        {/* Distance Badge */}
        {(routeInfo?.distanceText || directDistance) && (
          <View style={styles.topDistanceBadge}>
            <Ionicons name="navigate" size={13} color="#fff" style={{ marginRight: 4 }} />
            <Text style={styles.topDistanceText}>{routeInfo?.distanceText || directDistance}</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <Chip
          label="Map & Route"
          active={activeTab === 'map'}
          onPress={() => setActiveTab('map')}
          icon={<Ionicons name="map" size={14} color={activeTab === 'map' ? '#fff' : C.ink3} />}
        />
        <Chip
          label="Details"
          active={activeTab === 'details'}
          onPress={() => setActiveTab('details')}
          icon={<Ionicons name="information-circle" size={14} color={activeTab === 'details' ? '#fff' : C.ink3} />}
        />
        <Chip
          label="Timeline"
          active={activeTab === 'timeline'}
          onPress={() => setActiveTab('timeline')}
          icon={<Ionicons name="git-network" size={14} color={activeTab === 'timeline' ? '#fff' : C.ink3} />}
        />
        <Chip
          label={`Chat (${msgs.length})`}
          active={activeTab === 'chat'}
          onPress={() => setActiveTab('chat')}
          icon={<Ionicons name="chatbubbles" size={14} color={activeTab === 'chat' ? '#fff' : C.ink3} />}
        />
      </View>

      {/* TAB 1: OPENSTREETMAP & NAVIGATION */}
      {activeTab === 'map' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACE.md }}>
          {/* Dedicated Navigation Card for Responders */}
          <Card style={styles.navCard}>
            <View style={styles.navHeaderRow}>
              <View style={styles.navIconWrap}>
                <Ionicons name="navigate" size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.navTitle}>
                  {myLocation ? 'OpenStreetMap Live Navigation' : 'Emergency Location Broadcast'}
                </Text>
                <Text style={styles.navSub}>
                  {routeInfo?.distanceText
                    ? `Estimated distance: ${routeInfo.distanceText} (${routeInfo.durationText})`
                    : '100% Free OpenStreetMap Navigation'}
                </Text>
              </View>
              {routingLoading && <ActivityIndicator size="small" color={C.accent} />}
            </View>

            {/* Interactive OpenStreetMap */}
            <View style={{ marginTop: SPACE.md }}>
              <OSMMapView
                height={320}
                emergencyLocation={{
                  latitude: Number(sos.latitude),
                  longitude: Number(sos.longitude),
                  title: `${sos.user || 'Resident'} - ${categoryMeta.short}`,
                  category: sos.category,
                }}
                responderLocation={
                  myLocation
                    ? {
                        latitude: Number(myLocation.latitude),
                        longitude: Number(myLocation.longitude),
                        title: user?.username || 'Your Location',
                      }
                    : null
                }
                routeCoordinates={routeInfo?.coordinates || []}
                distanceText={routeInfo?.distanceText || directDistance}
                durationText={routeInfo?.durationText}
                showRoute={true}
              />
            </View>

            {/* Location Points Breakdown */}
            <View style={styles.locationPoints}>
              {myLocation && (
                <View style={styles.pointRow}>
                  <View style={[styles.pointDot, { backgroundColor: '#2563EB' }]} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.pointLabel}>Your Current Location</Text>
                    <Text style={styles.pointCoords}>
                      {myLocation.latitude}, {myLocation.longitude}
                    </Text>
                  </View>
                </View>
              )}

              {myLocation && <View style={styles.pointLine} />}

              <View style={styles.pointRow}>
                <View style={[styles.pointDot, { backgroundColor: '#EF4444' }]} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.pointLabel}>Emergency Destination ({sos.user || 'Resident'})</Text>
                  <Text style={styles.pointCoords}>
                    {sos.latitude}, {sos.longitude}
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick Refresh Location Button */}
            <TouchableOpacity
              style={styles.refreshLocBtn}
              onPress={() => updateRouteAndLocation(sos)}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-circle" size={18} color={C.accent} style={{ marginRight: 6 }} />
              <Text style={styles.refreshLocText}>Recalculate Route & GPS</Text>
            </TouchableOpacity>
          </Card>

          {/* Responder Quick Action Bar */}
          {canAccept && (
            <Card style={{ marginTop: SPACE.xs, borderColor: C.safe }}>
              <Text style={{ fontWeight: '800', color: C.ink, fontSize: 16 }}>Ready to Assist?</Text>
              <Text style={{ color: C.muted, marginTop: 4, marginBottom: 12, fontSize: 13 }}>
                Accepting will notify the resident and community that you are responding on-ground.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Btn
                  title="Accept & Respond"
                  kind="safe"
                  loading={busy}
                  onPress={handleAccept}
                  icon={<Ionicons name="checkmark-circle" size={18} color="#fff" />}
                  style={{ flex: 2 }}
                />
                <Btn
                  title="Decline"
                  kind="ghost"
                  loading={busy}
                  onPress={handleDecline}
                  style={{ flex: 1 }}
                />
              </View>
            </Card>
          )}

          {/* Active Response Actions */}
          {(canResolve || canClose || canEscalate) && (
            <Card style={{ marginTop: SPACE.xs }}>
              <Text style={{ fontWeight: '800', color: C.ink, fontSize: 15, marginBottom: 10 }}>
                Response Control Center
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {canResolve && (
                  <Btn
                    title="Mark Resolved"
                    kind="safe"
                    small
                    onPress={() => setResolveModal(true)}
                    icon={<Ionicons name="checkbox" size={16} color="#fff" />}
                    style={{ flex: 1, minWidth: 130 }}
                  />
                )}
                {canEscalate && (
                  <Btn
                    title="Escalate Alert"
                    kind="sos"
                    small
                    onPress={() => setEscalateModal(true)}
                    icon={<Ionicons name="alert-circle" size={16} color="#fff" />}
                    style={{ flex: 1, minWidth: 130 }}
                  />
                )}
                {canClose && (
                  <Btn
                    title="Close Incident"
                    kind="primary"
                    small
                    onPress={() => setCloseModal(true)}
                    icon={<Ionicons name="lock-closed" size={16} color="#fff" />}
                    style={{ flex: 1, minWidth: 130 }}
                  />
                )}
              </View>
            </Card>
          )}
        </ScrollView>
      )}

      {/* TAB 2: DETAILS & ACTIONS */}
      {activeTab === 'details' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACE.md }}>
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <CategoryBadge category={sos.category} />
              <StatusBadge status={sos.status} />
            </View>

            <Text style={{ fontSize: 16, fontWeight: '800', color: C.ink, marginTop: 12 }}>
              Emergency Details
            </Text>
            <Text style={{ color: C.muted, marginTop: 4 }}>
              Raised by <Text style={{ fontWeight: '700', color: C.ink }}>{sos.user}</Text> • {fmt(sos.created_at)}
            </Text>

            {sos.message ? (
              <View style={styles.msgBox}>
                <Text style={styles.msgBoxText}>"{sos.message}"</Text>
              </View>
            ) : null}

            <View style={styles.metaDivider} />

            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Incident Identifier:</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.detailVal}>#{sos.id}</Text>
                <IdBadge id={sos.id} prefix="SOS" size="sm" />
              </View>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Emergency Category:</Text>
              <Text style={styles.detailVal}>{categoryMeta.label}</Text>
            </View>

            {sos.user_id && (
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Resident User ID:</Text>
                <Text style={styles.detailVal}>{fmtUsrId(sos.user_id)} ({sos.user})</Text>
              </View>
            )}

            {(sos.society_name || sos.society_id) && (
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Society:</Text>
                <Text style={styles.detailVal}>
                  {sos.society_name || 'Society'} ({fmtSocId(sos.society_id)})
                </Text>
              </View>
            )}

            {(sos.block_name || sos.block_id) && (
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Tower / Block:</Text>
                <Text style={styles.detailVal}>
                  {sos.block_name || 'Block'} ({fmtBlkId(sos.block_id)})
                </Text>
              </View>
            )}

            {(sos.flat_number || sos.flat_id) && (
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Flat / Apartment:</Text>
                <Text style={styles.detailVal}>
                  #{sos.flat_number || sos.flat_id} ({fmtFltId(sos.flat_id)})
                </Text>
              </View>
            )}

            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Assigned Responder:</Text>
              <Text style={[styles.detailVal, { color: sos.responder ? C.safeDark : C.muted }]}>
                {sos.responder ? `${sos.responder} (${fmtUsrId(sos.responder_id)})` : 'Searching for responders...'}
              </Text>
            </View>

            {sos.resolved_at && (
              <View style={styles.detailRow}>
                <Text style={styles.detailKey}>Resolved At:</Text>
                <Text style={styles.detailVal}>{fmt(sos.resolved_at)}</Text>
              </View>
            )}
          </Card>

          {/* Action Center */}
          <Card>
            <Text style={{ fontWeight: '800', color: C.ink, fontSize: 15, marginBottom: 10 }}>
              Incident Actions
            </Text>

            {canAccept && (
              <View style={{ marginBottom: 10 }}>
                <Btn
                  title="Accept Emergency Request"
                  kind="safe"
                  loading={busy}
                  onPress={handleAccept}
                  icon={<Ionicons name="checkmark-circle" size={18} color="#fff" />}
                />
              </View>
            )}

            {canResolve && (
              <View style={{ marginBottom: 10 }}>
                <Btn
                  title="Mark as Resolved"
                  kind="safe"
                  onPress={() => setResolveModal(true)}
                  icon={<Ionicons name="checkbox-outline" size={18} color="#fff" />}
                />
              </View>
            )}

            {canEscalate && (
              <View style={{ marginBottom: 10 }}>
                <Btn
                  title="Escalate to Secondary / SMS"
                  kind="dangerGhost"
                  onPress={() => setEscalateModal(true)}
                  icon={<Ionicons name="alert-circle-outline" size={18} color={C.sosInk} />}
                />
              </View>
            )}

            {canClose && (
              <View style={{ marginBottom: 10 }}>
                <Btn
                  title="Close Incident (Admin)"
                  kind="primary"
                  onPress={() => setCloseModal(true)}
                  icon={<Ionicons name="lock-closed-outline" size={18} color="#fff" />}
                />
              </View>
            )}

            <Btn
              title="Open Chat with Responders"
              kind="soft"
              onPress={() => setActiveTab('chat')}
              icon={<Ionicons name="chatbubbles-outline" size={18} color={C.accentInk} />}
            />
          </Card>
        </ScrollView>
      )}

      {/* TAB 3: TIMELINE & HISTORY */}
      {activeTab === 'timeline' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: SPACE.md }}>
          <Card>
            <Text style={{ fontWeight: '800', color: C.ink, fontSize: 16, marginBottom: 4 }}>
              Incident Audit Timeline
            </Text>
            <Text style={{ color: C.muted, fontSize: 12.5, marginBottom: 16 }}>
              Chronological log of alerts, notifications, and responder actions.
            </Text>

            {history.length === 0 ? (
              <Empty
                title="No events logged yet"
                text="Actions taken on this incident will appear in this audit log."
                icon={<Ionicons name="time" size={24} color={C.accent} />}
              />
            ) : (
              history.map((h, i) => (
                <View key={h.id || i} style={styles.timelineItem}>
                  <View style={styles.timelineDotWrap}>
                    <View style={styles.timelineDot} />
                    {i < history.length - 1 && <View style={styles.timelineConnector} />}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineAction}>{niceAction(h.action)}</Text>
                    {h.note ? <Text style={styles.timelineNote}>{h.note}</Text> : null}
                    <Text style={styles.timelineMeta}>
                      {fmt(h.created_at)}
                      {h.performed_by ? ` • By ${h.performed_by}` : ''}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </Card>
        </ScrollView>
      )}

      {/* TAB 4: REAL-TIME INCIDENT CHAT */}
      {activeTab === 'chat' && (
        <View style={{ flex: 1 }}>
          <FlatList
            ref={listRef}
            data={msgs}
            keyExtractor={(m) => String(m.id || Math.random())}
            contentContainerStyle={{ padding: SPACE.md, flexGrow: 1 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <Empty
                title="Incident Chat"
                text="Coordinate in real time with the resident and fellow responders."
                icon={<Ionicons name="chatbubbles" size={26} color={C.accent} />}
              />
            }
            renderItem={({ item }) => {
              const isMine = item.sender === user?.username;
              return (
                <View
                  style={[
                    styles.chatBubble,
                    isMine ? styles.chatBubbleMine : styles.chatBubbleOther,
                  ]}
                >
                  {!isMine && <Text style={styles.chatSender}>{item.sender}</Text>}
                  <Text style={isMine ? styles.chatMsgMine : styles.chatMsgOther}>{item.message}</Text>
                  <Text style={isMine ? styles.chatTimeMine : styles.chatTimeOther}>
                    {fmt(item.created_at)}
                  </Text>
                </View>
              );
            }}
          />

          <View style={[styles.chatInputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <TextInput
              value={chatText}
              onChangeText={setChatText}
              placeholder="Type message to responders..."
              placeholderTextColor={C.faint}
              style={styles.chatInput}
              multiline
            />
            <TouchableOpacity
              onPress={sendChatMessage}
              style={[styles.sendBtn, !chatText.trim() && { opacity: 0.5 }]}
              disabled={!chatText.trim()}
            >
              <Ionicons name="send" size={17} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Resolve Incident Modal */}
      <ActionModal
        visible={resolveModal}
        onClose={() => setResolveModal(false)}
        title="Resolve Emergency"
        subtitle="Provide a brief summary of how the emergency was resolved."
        submitText="Confirm Resolved"
        submitKind="safe"
        loading={busy}
        onSubmit={handleResolve}
      >
        <TextInput
          value={resolveNote}
          onChangeText={setResolveNote}
          placeholder="e.g. First aid administered, medical assistance provided, resident safe."
          placeholderTextColor={C.faint}
          style={styles.modalInput}
          multiline
          numberOfLines={3}
        />
      </ActionModal>

      {/* Close Incident Modal */}
      <ActionModal
        visible={closeModal}
        onClose={() => setCloseModal(false)}
        title="Close Incident"
        subtitle="Officially close this incident and archive the emergency log."
        submitText="Close & Archive"
        submitKind="primary"
        loading={busy}
        onSubmit={handleClose}
      >
        <TextInput
          value={closeNote}
          onChangeText={setCloseNote}
          placeholder="Closure remarks / notes (optional)"
          placeholderTextColor={C.faint}
          style={styles.modalInput}
          multiline
          numberOfLines={2}
        />
      </ActionModal>

      {/* Escalate Incident Modal */}
      <ActionModal
        visible={escalateModal}
        onClose={() => setEscalateModal(false)}
        title="Escalate Emergency"
        subtitle="This will alert secondary guardians and send emergency SMS to emergency contacts."
        submitText="Escalate Now"
        danger
        loading={busy}
        onSubmit={handleEscalate}
      >
        <TextInput
          value={escalateReason}
          onChangeText={setEscalateReason}
          placeholder="e.g. Critical condition, additional on-ground support required immediately."
          placeholderTextColor={C.faint}
          style={styles.modalInput}
          multiline
          numberOfLines={3}
        />
      </ActionModal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  topSummaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  residentTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.ink,
    marginTop: 4,
  },
  topDistanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  topDistanceText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 12,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACE.md,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  navCard: {
    padding: SPACE.md,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  navHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
  },
  navSub: {
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },
  locationPoints: {
    marginTop: SPACE.md,
    padding: SPACE.md,
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.line,
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pointDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  pointLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: C.ink,
  },
  pointCoords: {
    fontSize: 11,
    color: C.muted,
    marginTop: 1,
  },
  pointLine: {
    width: 2,
    height: 16,
    backgroundColor: '#CBD5E1',
    marginLeft: 4,
    marginVertical: 2,
  },
  refreshLocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACE.sm,
    paddingVertical: 8,
  },
  refreshLocText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: C.accent,
  },
  msgBox: {
    backgroundColor: C.sosSoft,
    padding: 10,
    borderRadius: RADIUS.sm,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: C.sos,
  },
  msgBoxText: {
    color: C.sosInk,
    fontSize: 13.5,
    fontStyle: 'italic',
  },
  metaDivider: {
    height: 1,
    backgroundColor: C.lineLight,
    marginVertical: SPACE.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailKey: {
    color: C.muted,
    fontSize: 13,
  },
  detailVal: {
    fontWeight: '700',
    color: C.ink,
    fontSize: 13,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: SPACE.md,
  },
  timelineDotWrap: {
    alignItems: 'center',
    width: 20,
    marginRight: 10,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.accent,
    marginTop: 4,
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    backgroundColor: C.line,
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 8,
  },
  timelineAction: {
    fontSize: 13.5,
    fontWeight: '800',
    color: C.ink,
  },
  timelineNote: {
    fontSize: 12.5,
    color: C.ink2,
    marginTop: 2,
  },
  timelineMeta: {
    fontSize: 11,
    color: C.muted,
    marginTop: 3,
  },
  chatBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    marginBottom: 8,
  },
  chatBubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#0F172A',
    borderBottomRightRadius: 2,
  },
  chatBubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.line,
    borderBottomLeftRadius: 2,
  },
  chatSender: {
    fontSize: 11,
    fontWeight: '800',
    color: C.accent,
    marginBottom: 3,
  },
  chatMsgMine: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  chatMsgOther: {
    color: C.ink,
    fontSize: 14,
  },
  chatTimeMine: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'right',
  },
  chatTimeOther: {
    fontSize: 10,
    color: C.muted,
    marginTop: 4,
  },
  chatInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.2,
    borderColor: C.line,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: C.ink,
    maxHeight: 90,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  modalInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1.2,
    borderColor: C.line,
    borderRadius: RADIUS.sm,
    padding: 12,
    fontSize: 14,
    color: C.ink,
    textAlignVertical: 'top',
  },
});