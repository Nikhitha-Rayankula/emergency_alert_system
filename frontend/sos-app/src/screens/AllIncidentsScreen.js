import React, { useState, useCallback } from 'react';
import { FlatList, Text, View, Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import IncidentCard from '../components/IncidentCard';
import { Card, Chip, Empty, SkeletonList, C, SPACE, RADIUS } from '../ui';
import { useAuth } from '../AuthContext';
import api, { errorText } from '../api';

const FILTERS = ['All', 'Open', 'Active', 'Resolved', 'Closed'];

export default function AllIncidentsScreen({ navigation }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadIncidents = useCallback(async () => {
    try {
      const res = await api.get('/incidents/all/').catch(() => null);
      if (res && Array.isArray(res.data)) {
        setItems(res.data);
      } else {
        // Fallback: notifications contain recent SOS links
        const notifsRes = await api.get('/notifications/').catch(() => ({ data: [] }));
        const sosIds = Array.from(
          new Set((notifsRes.data || []).map((n) => n.sos).filter(Boolean))
        );
        const sosDetails = await Promise.all(
          sosIds.slice(0, 20).map((id) =>
            api.get(`/sos/${id}/`).then((r) => r.data).catch(() => null)
          )
        );
        setItems(sosDetails.filter(Boolean));
      }
    } catch (e) {
      console.log('Incidents load error:', e.message);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadIncidents();
    }, [loadIncidents])
  );

  const filteredItems = items.filter((item) => {
    if (filter === 'All') return true;
    if (filter === 'Open') return ['open', 'escalated'].includes(item.status);
    if (filter === 'Active') return item.status === 'active_response';
    if (filter === 'Resolved') return item.status === 'resolved';
    if (filter === 'Closed') return ['closed', 'cancelled'].includes(item.status);
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header
        title="Incident Monitor"
        subtitle={`${items.length} incidents monitored`}
        onRefresh={() => {
          setRefreshing(true);
          loadIncidents();
        }}
      />

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Chip
            key={f}
            label={f}
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
          loadIncidents();
        }}
        ListEmptyComponent={
          loading ? (
            <SkeletonList rows={3} />
          ) : (
            <Empty
              title="No Incidents Reported"
              text={
                filter === 'All'
                  ? 'No emergency incidents currently active in the system.'
                  : `No ${filter.toLowerCase()} incidents found.`
              }
              icon={<Ionicons name="shield-outline" size={32} color={C.accent} />}
            />
          )
        }
        renderItem={({ item }) => (
          <IncidentCard
            incident={item}
            onPress={() => navigation.navigate('IncidentDetail', { id: item.id })}
          />
        )}
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
});
