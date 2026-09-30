import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import ActionModal from '../components/ActionModal';
import { Card, Btn, Chip, Field, Empty, SkeletonList, C, SPACE, RADIUS } from '../ui';
import { useAuth } from '../AuthContext';
import { useToast } from '../Toast';
import api, { errorText } from '../api';

export default function SocietyStructureScreen({ navigation }) {
  const { user } = useAuth();
  const toast = useToast();

  const [society, setSociety] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [flats, setFlats] = useState([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [loadingFlats, setLoadingFlats] = useState(false);

  // Modals
  const [addBlockModal, setAddBlockModal] = useState(false);
  const [blockForm, setBlockForm] = useState({ name: '', code: '' });

  const [addFlatModal, setAddFlatModal] = useState(false);
  const [flatForm, setFlatForm] = useState({ flat_number: '', floor: '', flat_type: '2BHK' });

  const [busy, setBusy] = useState(false);

  // Load society & blocks
  const loadBlocks = useCallback(async () => {
    setLoadingBlocks(true);
    try {
      const socRes = await api.get('/gated-society/mine/');
      setSociety(socRes.data);

      if (socRes.data?.id) {
        const { data } = await api.get(`/societies/${socRes.data.id}/blocks/`);
        setBlocks(data || []);
        if (data && data.length > 0 && !selectedBlock) {
          setSelectedBlock(data[0]);
        }
      }
    } catch (e) {
      console.log('Structure load error:', e.message);
    }
    setLoadingBlocks(false);
  }, [selectedBlock]);

  // Load flats for selected block
  const loadFlats = useCallback(async (blockId) => {
    if (!blockId) return;
    setLoadingFlats(true);
    try {
      const { data } = await api.get(`/blocks/${blockId}/flats/`);
      setFlats(data || []);
    } catch (e) {
      console.log('Flats load error:', e.message);
    }
    setLoadingFlats(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBlocks();
    }, [loadBlocks])
  );

  useEffect(() => {
    if (selectedBlock?.id) {
      loadFlats(selectedBlock.id);
    }
  }, [selectedBlock, loadFlats]);

  const handleAddBlock = async () => {
    if (!blockForm.name.trim() || !blockForm.code.trim()) {
      Alert.alert('Fields Required', 'Please provide a block name (e.g. Tower A) and code (e.g. A).');
      return;
    }

    setBusy(true);
    try {
      await api.post('/blocks/add/', {
        name: blockForm.name.trim(),
        code: blockForm.code.trim(),
        gated_society: society?.id,
      });

      setAddBlockModal(false);
      setBlockForm({ name: '', code: '' });
      toast('Block created successfully', 'success');
      loadBlocks();
    } catch (e) {
      Alert.alert('Failed to Add Block', errorText(e));
    }
    setBusy(false);
  };

  const handleAddFlat = async () => {
    if (!selectedBlock?.id) {
      Alert.alert('Select a Block', 'Please select a block first.');
      return;
    }
    if (!flatForm.flat_number.trim()) {
      Alert.alert('Flat Number Required', 'Please enter a flat number (e.g. 101, 204).');
      return;
    }

    setBusy(true);
    try {
      await api.post('/flats/add/', {
        block: selectedBlock.id,
        flat_number: flatForm.flat_number.trim(),
        floor: flatForm.floor ? Number(flatForm.floor) : null,
        flat_type: flatForm.flat_type,
      });

      setAddFlatModal(false);
      setFlatForm({ flat_number: '', floor: '', flat_type: '2BHK' });
      toast(`Flat #${flatForm.flat_number} created in ${selectedBlock.name}`, 'success');
      loadFlats(selectedBlock.id);
    } catch (e) {
      Alert.alert('Failed to Add Flat', errorText(e));
    }
    setBusy(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header
        title="Blocks & Flats"
        subtitle={society?.society_name || 'Society Tower Infrastructure'}
        onRefresh={loadBlocks}
      />

      {/* Blocks Horizontal Selector */}
      <View style={styles.blockSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Towers / Blocks ({blocks.length})</Text>
          <TouchableOpacity
            style={styles.addSmallBtn}
            onPress={() => setAddBlockModal(true)}
          >
            <Ionicons name="add" size={16} color={C.accent} />
            <Text style={styles.addSmallBtnText}>Add Block</Text>
          </TouchableOpacity>
        </View>

        {loadingBlocks ? (
          <SkeletonList rows={1} />
        ) : blocks.length === 0 ? (
          <Card style={{ marginHorizontal: SPACE.lg, alignItems: 'center', padding: SPACE.md }}>
            <Text style={{ color: C.muted, fontSize: 13 }}>No blocks configured yet.</Text>
            <Btn
              title="+ Create First Block"
              small
              kind="soft"
              onPress={() => setAddBlockModal(true)}
              style={{ marginTop: 8 }}
            />
          </Card>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingVertical: 6 }}
          >
            {blocks.map((blk) => {
              const isSelected = selectedBlock?.id === blk.id;
              return (
                <TouchableOpacity
                  key={blk.id}
                  activeOpacity={0.8}
                  onPress={() => setSelectedBlock(blk)}
                  style={[
                    styles.blockPill,
                    isSelected && styles.blockPillActive,
                  ]}
                >
                  <Ionicons
                    name="business"
                    size={16}
                    color={isSelected ? '#fff' : C.ink3}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.blockPillText, isSelected && { color: '#fff' }]}>
                    {blk.name} ({blk.code})
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Flats Section */}
      <View style={styles.flatsHeader}>
        <Text style={styles.sectionTitle}>
          Flats in {selectedBlock?.name || 'Selected Block'} ({flats.length})
        </Text>
        {selectedBlock && (
          <Btn
            title="+ Add Flat"
            small
            kind="primary"
            onPress={() => setAddFlatModal(true)}
            icon={<Ionicons name="add" size={16} color="#fff" />}
          />
        )}
      </View>

      <FlatList
        data={flats}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 40 }}
        refreshing={loadingFlats}
        onRefresh={() => selectedBlock && loadFlats(selectedBlock.id)}
        ListEmptyComponent={
          loadingFlats ? (
            <SkeletonList rows={3} />
          ) : (
            <Empty
              title="No Flats Added"
              text={
                selectedBlock
                  ? `There are no flats in ${selectedBlock.name} yet. Tap "+ Add Flat" to register apartments.`
                  : 'Please create or select a block above.'
              }
              icon={<Ionicons name="home-outline" size={32} color={C.accent} />}
            />
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.flatCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={styles.flatIconWrap}>
                  <Ionicons name="home" size={20} color={C.accentInk} />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.flatNumber}>Flat #{item.flat_number}</Text>
                  <Text style={styles.flatSub}>
                    {item.floor ? `Floor ${item.floor}` : 'Ground / Level'} • {item.flat_type || 'Residential'}
                  </Text>
                </View>
              </View>

              <View style={styles.guardianInfo}>
                <Text style={styles.guardianLabel}>Flat Guardian</Text>
                <Text style={styles.guardianVal}>{item.guardian || 'Unassigned'}</Text>
              </View>
            </View>
          </Card>
        )}
      />

      {/* Add Block Modal */}
      <ActionModal
        visible={addBlockModal}
        onClose={() => setAddBlockModal(false)}
        title="Add Tower / Block"
        subtitle="Create a new residential building/block in your society."
        submitText="Create Block"
        loading={busy}
        onSubmit={handleAddBlock}
      >
        <Field
          label="Block Name"
          value={blockForm.name}
          onChangeText={(v) => setBlockForm({ ...blockForm, name: v })}
          placeholder="e.g. Tower A, Block 3, Lotus Wing"
        />
        <Field
          label="Block Code"
          value={blockForm.code}
          onChangeText={(v) => setBlockForm({ ...blockForm, code: v })}
          placeholder="e.g. A, T-1, B3"
        />
      </ActionModal>

      {/* Add Flat Modal */}
      <ActionModal
        visible={addFlatModal}
        onClose={() => setAddFlatModal(false)}
        title={`Add Flat to ${selectedBlock?.name || 'Block'}`}
        subtitle="Register an apartment unit."
        submitText="Add Flat"
        loading={busy}
        onSubmit={handleAddFlat}
      >
        <Field
          label="Flat / Door Number"
          value={flatForm.flat_number}
          onChangeText={(v) => setFlatForm({ ...flatForm, flat_number: v })}
          placeholder="e.g. 101, 204, Penthouse 1"
        />
        <Field
          label="Floor (Optional)"
          value={flatForm.floor}
          onChangeText={(v) => setFlatForm({ ...flatForm, floor: v })}
          placeholder="e.g. 1, 2, 10"
          keyboardType="number-pad"
        />
        <Field
          label="Flat Type"
          value={flatForm.flat_type}
          onChangeText={(v) => setFlatForm({ ...flatForm, flat_type: v })}
          placeholder="e.g. 2BHK, 3BHK, Studio"
        />
      </ActionModal>
    </View>
  );
}

const styles = StyleSheet.create({
  blockSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: SPACE.md,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACE.lg,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: C.ink,
  },
  addSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addSmallBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: C.accent,
    marginLeft: 3,
  },
  blockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.2,
    borderColor: C.line,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    marginRight: 8,
  },
  blockPillActive: {
    backgroundColor: C.ink,
    borderColor: C.ink,
  },
  blockPillText: {
    fontWeight: '700',
    fontSize: 13,
    color: C.ink2,
  },
  flatsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.lg,
    paddingBottom: SPACE.sm,
  },
  flatCard: {
    padding: SPACE.md,
    marginBottom: SPACE.sm,
  },
  flatIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flatNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
  },
  flatSub: {
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },
  guardianInfo: {
    alignItems: 'flex-end',
  },
  guardianLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: C.muted,
    textTransform: 'uppercase',
  },
  guardianVal: {
    fontSize: 12.5,
    fontWeight: '700',
    color: C.safeDark,
    marginTop: 2,
  },
});
