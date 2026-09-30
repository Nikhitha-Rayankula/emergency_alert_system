import React, { useState, useCallback } from 'react';
import { FlatList, Text, View, Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import IncidentCard from '../components/IncidentCard';
import { Card, Chip, Empty, SkeletonList, C, SPACE, RADIUS } from '../ui';
import api, { errorText } from '../api';

const FILTERS = ['All', 'Active', 'Resolved', 'Closed'];

export default function MyIncidents({ navigation }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/sos/mine/');
      setItems(data);
    } catch (e) {
      Alert.alert('Could Not Load Incidents', errorText(e));
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const filteredItems = items.filter((item) => {
    if (filter === 'All') return true;
    if (filter === 'Active') return ['open', 'escalated', 'active_response'].includes(item.status);
    if (filter === 'Resolved') return item.status === 'resolved';
    if (filter === 'Closed') return ['closed', 'cancelled'].includes(item.status);
    return true;
  });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header
        title="Incident History"
        subtitle={`${items.length} total emergency alerts raised`}
        onRefresh={() => {
          setRefreshing(true);
          load();
        }}
      />

      {/* Filter Chips */}
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
          load();
        }}
        ListEmptyComponent={
          loading ? (
            <SkeletonList rows={3} />
          ) : (
            <Empty
              title="No Incidents Found"
              text={
                filter === 'All'
                  ? 'You have not triggered any SOS alerts yet.'
                  : `No ${filter.toLowerCase()} incidents found in your history.`
              }
              icon={<Ionicons name="shield-outline" size={28} color={C.accent} />}
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