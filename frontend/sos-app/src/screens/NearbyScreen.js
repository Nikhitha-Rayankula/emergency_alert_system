import React, { useState, useCallback } from 'react';
import { FlatList, Text, View, Switch, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Screen, Card, Btn, Empty,SkeletonList, C, catLabel } from '../ui';
import api, { errorText } from '../api';
import { getPosition } from '../location';

export default function NearbyScreen({ navigation }) {
  const [available, setAvailable] = useState(true);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const pos = await getPosition();
      await api.patch('/users/me/location/', pos);
      const { data } = await api.get('/responders/incidents/nearby/', { params: { ...pos, radius: 2000 } });
      setItems(data);
      if (!data.length) setMsg('No open incidents within 2 km.');
    } catch (e) {
      setMsg(errorText(e));
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (v) => {
    setAvailable(v);
    try {
      await api.patch('/responders/me/availability/', { available: v });
    } catch (e) {
      setAvailable(!v);
      Alert.alert('Could not update availability', errorText(e));
    }
  };

  return (
    <Screen title="Nearby" subtitle="Open incidents within 2 km of you">
      <Card style={{ marginHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={{ fontWeight: '700', color: C.ink }}>{available ? 'Available' : 'Unavailable'}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>Turn off when you cannot respond</Text>
        </View>
        <Switch value={available} onValueChange={toggle} trackColor={{ true: C.safe }} />
      </Card>
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={{ padding: 16 }}
        refreshing={loading}
        onRefresh={load}
        ListEmptyComponent={
          loading
            ? <SkeletonList rows={3} />
            : msg
              ? <Empty title="Nothing to show" text={msg} />
              : null
        }
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate('IncidentDetail', { id: item.id })}>
            <Text style={{ fontWeight: '700', color: C.ink }}>{catLabel(item.category)} · {item.distance_meters} m away</Text>
            <Text style={{ color: C.muted, marginTop: 4 }}>{item.user}{item.message ? `: ${item.message}` : ''}</Text>
          </Card>
        )}
      />
      <View style={{ padding: 16 }}>
        <Btn kind="soft" title="Refresh my location" onPress={load} loading={loading} />
      </View>
    </Screen>
  );
}