import React, { useState, useCallback } from 'react';
import { FlatList, Text, View, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import { Card, Chip, Empty, SkeletonList, C, SPACE, RADIUS, fmt } from '../ui';
import api from '../api';

const ALERT_FILTERS = ['All', 'Unread', 'Read'];

export default function AlertsScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('All');
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/');
      setItems(data || []);
    } catch (e) {
      // Keep last list
    }
    setLoaded(true);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
      const interval = setInterval(load, 8000);
      return () => clearInterval(interval);
    }, [load])
  );

  const openNotification = (notif) => {
    if (!notif.is_read) {
      api.patch(`/notifications/${notif.id}/read/`).then(load).catch(() => {});
    }
    if (notif.sos) {
      navigation.navigate('IncidentDetail', { id: notif.sos });
    }
  };

  const filteredItems = items.filter((n) => {
    if (filter === 'Unread') return !n.is_read;
    if (filter === 'Read') return n.is_read;
    return true;
  });

  const unreadCount = items.filter((n) => !n.is_read).length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header
        title="Emergency Alerts"
        subtitle={`${unreadCount} unread notifications`}
        onRefresh={() => {
          setRefreshing(true);
          load();
        }}
      />

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {ALERT_FILTERS.map((f) => (
          <Chip
            key={f}
            label={f === 'Unread' ? `Unread (${unreadCount})` : f}
            active={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </View>

      <FlatList
        data={filteredItems}
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
              title="No Notifications"
              text={
                filter === 'Unread'
                  ? 'All notifications have been read!'
                  : 'You will receive instant emergency alerts and updates here.'
              }
              icon={<Ionicons name="notifications-outline" size={32} color={C.accent} />}
            />
          )
        }
        renderItem={({ item }) => {
          const isUnread = !item.is_read;
          return (
            <Card
              onPress={() => openNotification(item)}
              borderTone={isUnread ? C.sos : null}
              style={[styles.notifCard, isUnread && { backgroundColor: C.accentSoft + '40' }]}
            >
              <View style={styles.topRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  {isUnread ? (
                    <View style={styles.unreadDot} />
                  ) : (
                    <Ionicons name="notifications-outline" size={16} color={C.muted} style={{ marginRight: 6 }} />
                  )}
                  <Text style={[styles.notifTitle, isUnread && { fontWeight: '800' }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                </View>
                <Text style={styles.notifTime}>{fmt(item.created_at)}</Text>
              </View>

              <Text style={styles.notifMsg} numberOfLines={3}>
                {item.message}
              </Text>

              {/* Delivery Channels Status */}
              <View style={styles.deliveryRow}>
                <View style={styles.channelBadge}>
                  <Ionicons
                    name={item.email_delivered ? 'mail' : 'mail-outline'}
                    size={12}
                    color={item.email_delivered ? C.safeDark : C.faint}
                  />
                  <Text style={[styles.channelText, item.email_delivered && { color: C.safeDark }]}>Email</Text>
                </View>

                <View style={styles.channelBadge}>
                  <Ionicons
                    name={item.sms_delivered ? 'chatbubble' : 'chatbubble-outline'}
                    size={12}
                    color={item.sms_delivered ? C.safeDark : C.faint}
                  />
                  <Text style={[styles.channelText, item.sms_delivered && { color: C.safeDark }]}>SMS</Text>
                </View>

                <View style={styles.channelBadge}>
                  <Ionicons
                    name={item.push_delivered ? 'phone-portrait' : 'phone-portrait-outline'}
                    size={12}
                    color={item.push_delivered ? C.safeDark : C.faint}
                  />
                  <Text style={[styles.channelText, item.push_delivered && { color: C.safeDark }]}>Push</Text>
                </View>

                {item.sos && (
                  <View style={styles.openSosLink}>
                    <Text style={styles.openSosText}>View Incident</Text>
                    <Ionicons name="chevron-forward" size={13} color={C.accent} />
                  </View>
                )}
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACE.lg,
    paddingVertical: 4,
    backgroundColor: C.bg,
  },
  notifCard: {
    padding: SPACE.md,
    marginBottom: SPACE.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.sos,
    marginRight: 8,
  },
  notifTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: C.ink,
    flex: 1,
  },
  notifTime: {
    fontSize: 11,
    color: C.muted,
    marginLeft: 8,
  },
  notifMsg: {
    fontSize: 13,
    color: C.ink2,
    lineHeight: 18,
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.lineLight,
    gap: 8,
  },
  channelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  channelText: {
    fontSize: 10,
    color: C.muted,
    marginLeft: 4,
    fontWeight: '600',
  },
  openSosLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  openSosText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: C.accent,
  },
});