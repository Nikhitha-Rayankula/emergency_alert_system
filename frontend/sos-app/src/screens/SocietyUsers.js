import React, { useState, useCallback, useEffect } from 'react';
import { FlatList, Text, View, Alert, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import ActionModal from '../components/ActionModal';
import { Card, Btn, Chip, Field, Empty, SkeletonList, C, SPACE, RADIUS, IdBadge, HierarchySummary, fmtSocId, fmtBlkId, fmtFltId, fmtUsrId, fmtInvId, fmt } from '../ui';
import { useAuth } from '../AuthContext';
import api, { errorText } from '../api';
import { useToast } from '../Toast';

const ROLES_FILTER = ['All', 'Resident', 'Guardian', 'Volunteer', 'Security', 'Sub Admin', 'Admin'];

export default function SocietyUsers() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.group_name === 'Admin';
  const isSubAdmin = user?.group_name === 'Sub Admin';

  const [activeTab, setActiveTab] = useState('members'); // 'members' | 'invites'
  const [items, setItems] = useState([]);
  const [invites, setInvites] = useState([]);
  const [filter, setFilter] = useState('All');
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Invite Modal
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteRole, setInviteRole] = useState(isAdmin ? 'Sub Admin' : 'Volunteer');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSociety, setInviteSociety] = useState('');
  const [inviteBlock, setInviteBlock] = useState('');
  const [inviteFlat, setInviteFlat] = useState('');
  const [busy, setBusy] = useState(false);

  // Hierarchical selection data for invite modal
  const [societiesList, setSocietiesList] = useState([]);
  const [blocksList, setBlocksList] = useState([]);
  const [flatsList, setFlatsList] = useState([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [loadingFlats, setLoadingFlats] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [usersRes, invitesRes, socRes] = await Promise.all([
        api.get('/society/users/').catch(() => ({ data: [] })),
        (isAdmin || isSubAdmin) ? api.get('/invites/').catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
        api.get('/gated-society/').catch(() => ({ data: [] })),
      ]);

      setItems(Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data?.results || []));
      setInvites(Array.isArray(invitesRes.data) ? invitesRes.data : (invitesRes.data?.results || []));

      const socList = Array.isArray(socRes.data) ? socRes.data : (socRes.data?.results || (socRes.data ? [socRes.data] : []));
      setSocietiesList(socList);
      if (socList.length > 0 && !inviteSociety) {
        setInviteSociety(String(socList[0].id));
      }
    } catch (e) {
      console.log('Error loading users/invites:', e.message);
    }
    setLoaded(true);
    setRefreshing(false);
  }, [isAdmin, isSubAdmin, inviteSociety]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // When selected society changes in modal, load its blocks
  const onSelectModalSociety = async (socId) => {
    setInviteSociety(String(socId));
    setInviteBlock('');
    setInviteFlat('');
    setBlocksList([]);
    setFlatsList([]);
    if (!socId) return;

    setLoadingBlocks(true);
    try {
      const { data } = await api.get(`/societies/${socId}/blocks/`);
      const list = Array.isArray(data) ? data : (data?.results || []);
      setBlocksList(list);
    } catch (e) {
      // Ignore
    }
    setLoadingBlocks(false);
  };

  // When selected block changes in modal, load its flats
  const onSelectModalBlock = async (blkId) => {
    setInviteBlock(String(blkId));
    setInviteFlat('');
    setFlatsList([]);
    if (!blkId) return;

    setLoadingFlats(true);
    try {
      const { data } = await api.get(`/blocks/${blkId}/flats/`);
      const list = Array.isArray(data) ? data : (data?.results || []);
      setFlatsList(list);
    } catch (e) {
      // Ignore
    }
    setLoadingFlats(false);
  };

  const removeUser = (u) => {
    Alert.alert(
      'Remove Member?',
      `Are you sure you want to permanently remove ${u.username} (${fmtUsrId(u.id)})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isAdmin) {
                await api.delete(`/admin/users/${u.id}/delete/`);
              } else {
                await api.delete(`/society/users/${u.id}/delete/`);
              }
              await loadData();
              toast(`${u.username} (${fmtUsrId(u.id)}) removed successfully`, 'success');
            } catch (e) {
              Alert.alert('Delete Failed', errorText(e));
            }
          },
        },
      ]
    );
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) {
      Alert.alert('Email Required', 'Please enter a valid recipient email address.');
      return;
    }

    if (inviteRole === 'Guardian' && !inviteFlat) {
      Alert.alert('Flat Selection Required', 'Please select a Society, Block, and Flat for this Guardian.');
      return;
    }

    if (inviteRole === 'Sub Admin' && !inviteSociety) {
      Alert.alert('Society Required', 'Please select the Society this Sub Admin will manage.');
      return;
    }

    setBusy(true);
    try {
      if (inviteRole === 'Volunteer') {
        await api.post('/invite/volunteer/', { email: inviteEmail.trim() });
      } else if (inviteRole === 'Security') {
        await api.post('/invite/security/', { email: inviteEmail.trim() });
      } else if (inviteRole === 'Guardian') {
        await api.post('/invite/guardian/', {
          email: inviteEmail.trim(),
          flat: Number(inviteFlat),
        });
      } else if (inviteRole === 'Sub Admin') {
        await api.post('/invite/subadmin/', {
          email: inviteEmail.trim(),
          gated_society: Number(inviteSociety),
        });
      } else if (inviteRole === 'Admin') {
        await api.post('/invite/admin/', { email: inviteEmail.trim() });
      }

      setInviteModal(false);
      setInviteEmail('');
      setInviteBlock('');
      setInviteFlat('');
      toast(`Official invitation sent to ${inviteEmail}`, 'success');
      loadData();
    } catch (e) {
      Alert.alert('Invite Failed', errorText(e));
    }
    setBusy(false);
  };

  const filteredUsers = items.filter((u) => {
    if (filter === 'All') return true;
    return u.group_name === filter;
  });

  const selectedSoc = societiesList.find((s) => String(s.id) === String(inviteSociety));
  const selectedBlk = blocksList.find((b) => String(b.id) === String(inviteBlock));
  const selectedFlt = flatsList.find((fl) => String(fl.id) === String(inviteFlat));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Header
        title={isAdmin ? 'Platform Directory' : 'Member Directory'}
        subtitle={`${items.length} members • ${invites.length} invitations`}
        onRefresh={() => {
          setRefreshing(true);
          loadData();
        }}
        right={
          (isAdmin || isSubAdmin) && (
            <Btn
              title="+ Invite"
              size="sm"
              kind="primary"
              onPress={() => {
                if (societiesList.length > 0 && !inviteSociety) {
                  onSelectModalSociety(societiesList[0].id);
                }
                setInviteModal(true);
              }}
              icon={<Ionicons name="mail" size={14} color="#fff" />}
            />
          )
        }
      />

      {/* Tabs: Active Members vs Invitations */}
      <View style={styles.topTabsBar}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setActiveTab('members')}
          style={[styles.topTabBtn, activeTab === 'members' && styles.topTabBtnActive]}
        >
          <Ionicons
            name="people"
            size={16}
            color={activeTab === 'members' ? C.accent : C.muted}
          />
          <Text style={[styles.topTabText, activeTab === 'members' && styles.topTabTextActive]}>
            Active Members ({items.length})
          </Text>
        </TouchableOpacity>

        {(isAdmin || isSubAdmin) && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTab('invites')}
            style={[styles.topTabBtn, activeTab === 'invites' && styles.topTabBtnActive]}
          >
            <Ionicons
              name="mail-unread"
              size={16}
              color={activeTab === 'invites' ? C.accent : C.muted}
            />
            <Text style={[styles.topTabText, activeTab === 'invites' && styles.topTabTextActive]}>
              Invitations ({invites.length})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Role Filter Chips for Members tab */}
      {activeTab === 'members' && (
        <View style={styles.filterScroll}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={ROLES_FILTER}
            keyExtractor={(item) => item}
            contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingVertical: 4 }}
            renderItem={({ item }) => (
              <Chip
                label={item}
                active={filter === item}
                onPress={() => setFilter(item)}
              />
            )}
          />
        </View>
      )}

      {/* Content depending on Active Tab */}
      {activeTab === 'members' ? (
        <FlatList
          data={filteredUsers}
          keyExtractor={(i) => String(i.id)}
          contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 40 }}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData();
          }}
          ListEmptyComponent={
            !loaded ? (
              <SkeletonList rows={3} />
            ) : (
              <Empty
                title="No Users Found"
                text={
                  filter === 'All'
                    ? 'No members registered in this society yet. Use the Invite button to invite team members.'
                    : `No members found under role "${filter}".`
                }
                icon={<Ionicons name="people-outline" size={32} color={C.accent} />}
              />
            )
          }
          renderItem={({ item }) => {
            const isCurrentUser = item.id === user?.id;
            return (
              <Card style={styles.userCard}>
                <View style={styles.userRow}>
                  <View style={styles.avatarWrap}>
                    <Text style={styles.avatarText}>
                      {(item.username || 'U').substring(0, 2).toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                      <Text style={styles.userName}>{item.username}</Text>
                      <IdBadge id={item.id} prefix="USR" size="sm" />
                      {isCurrentUser && (
                        <View style={styles.youBadge}>
                          <Text style={styles.youBadgeText}>YOU</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.userEmail}>{item.email}</Text>
                    {item.mobile ? <Text style={styles.userPhone}>{item.mobile}</Text> : null}

                    {/* Hierarchy details */}
                    {(item.society_name || item.gated_society) ? (
                      <Text style={styles.userHierarchy}>
                        📍 {item.society_name || `Society #${item.gated_society}`} ({fmtSocId(item.gated_society)})
                        {item.block_name ? ` → ${item.block_name} (${fmtBlkId(item.block_id)})` : ''}
                        {item.flat_number ? ` → Flat ${item.flat_number} (${fmtFltId(item.flat_id || item.flat)})` : ''}
                      </Text>
                    ) : null}
                  </View>

                  <View style={[styles.rolePill, { backgroundColor: C.accentSoft }]}>
                    <Text style={[styles.rolePillText, { color: C.accentInk }]}>
                      {item.group_name || 'Member'}
                    </Text>
                  </View>
                </View>

                {/* Admin delete action */}
                {(isSubAdmin || isAdmin) && !isCurrentUser && (
                  <View style={styles.cardActions}>
                    <Btn
                      kind="dangerGhost"
                      title="Remove Member"
                      size="sm"
                      onPress={() => removeUser(item)}
                      icon={<Ionicons name="trash-outline" size={14} color={C.sosInk} />}
                    />
                  </View>
                )}
              </Card>
            );
          }}
        />
      ) : (
        /* Invitations List */
        <FlatList
          data={invites}
          keyExtractor={(i) => String(i.id || i.token)}
          contentContainerStyle={{ padding: SPACE.lg, paddingBottom: 40 }}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData();
          }}
          ListEmptyComponent={
            !loaded ? (
              <SkeletonList rows={3} />
            ) : (
              <Empty
                title="No Pending Invitations"
                text="Tap '+ Invite' at the top to dispatch official email invitations."
                icon={<Ionicons name="mail-outline" size={32} color={C.accent} />}
              />
            )
          }
          renderItem={({ item }) => (
            <Card style={styles.inviteCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.inviteEmail}>{item.email}</Text>
                    <IdBadge id={item.id} prefix="INV" size="sm" />
                  </View>
                  <Text style={styles.inviteMeta}>
                    Role: <Text style={{ fontWeight: '800', color: C.ink }}>{item.role || 'Member'}</Text>
                    {' • '}Status: <Text style={{ fontWeight: '800', color: item.is_used ? C.muted : C.safe }}>{item.status || (item.is_used ? 'Used' : 'Pending')}</Text>
                  </Text>
                </View>

                <View style={[styles.statusBadge, item.is_used ? styles.statusUsed : styles.statusPending]}>
                  <Text style={[styles.statusText, item.is_used ? { color: C.muted } : { color: C.safeDark }]}>
                    {item.is_used ? 'ACCEPTED' : 'PENDING'}
                  </Text>
                </View>
              </View>

              {/* Hierarchy information */}
              <View style={styles.inviteHierarchyBox}>
                <Text style={styles.inviteHierarchyText}>
                  {item.society_name ? `Society: ${item.society_name} (${fmtSocId(item.society_id)})` : ''}
                  {item.block_name ? ` • Block: ${item.block_name} (${fmtBlkId(item.block_id)})` : ''}
                  {item.flat_number ? ` • Flat: ${item.flat_number} (${fmtFltId(item.flat_id)})` : ''}
                </Text>
                {item.created_at && (
                  <Text style={styles.inviteDateText}>Sent {fmt.relTime(item.created_at)}</Text>
                )}
              </View>
            </Card>
          )}
        />
      )}

      {/* Invite Member Modal with Step-by-Step Dependent Selectors and Confirmation */}
      <ActionModal
        visible={inviteModal}
        onClose={() => setInviteModal(false)}
        title="Invite Official / Resident"
        subtitle="Send an official email registration invitation with deep link."
        submitText="Send Invitation"
        loading={busy}
        onSubmit={sendInvite}
      >
        <Text style={styles.modalLabel}>Role to Assign:</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {(isAdmin
            ? ['Volunteer', 'Security', 'Guardian', 'Sub Admin', 'Admin']
            : ['Volunteer', 'Security', 'Guardian']
          ).map((r) => (
            <Chip
              key={r}
              label={r}
              active={inviteRole === r}
              onPress={() => {
                setInviteRole(r);
                if (r === 'Guardian' && societiesList.length > 0 && !inviteSociety) {
                  onSelectModalSociety(societiesList[0].id);
                }
              }}
            />
          ))}
        </View>

        <Field
          label="Recipient Email Address"
          value={inviteEmail}
          onChangeText={setInviteEmail}
          placeholder="member@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* Sub Admin: Select Society */}
        {inviteRole === 'Sub Admin' && (
          <View style={styles.modalPickerArea}>
            <Text style={styles.pickerSubheading}>Assign Managed Society:</Text>
            {societiesList.length > 0 ? (
              <View style={styles.chipGrid}>
                {societiesList.map((soc) => (
                  <Chip
                    key={soc.id}
                    label={`${soc.society_name} (${fmtSocId(soc.id)})`}
                    active={String(inviteSociety) === String(soc.id)}
                    onPress={() => setInviteSociety(String(soc.id))}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.emptyHintText}>No societies available.</Text>
            )}
          </View>
        )}

        {/* Guardian: Dependent Hierarchy Selection (Society -> Block -> Flat) */}
        {inviteRole === 'Guardian' && (
          <View style={styles.modalPickerArea}>
            <Text style={styles.pickerSubheading}>1. Select Society:</Text>
            <View style={styles.chipGrid}>
              {societiesList.map((soc) => (
                <Chip
                  key={soc.id}
                  label={`${soc.society_name} (${fmtSocId(soc.id)})`}
                  active={String(inviteSociety) === String(soc.id)}
                  onPress={() => onSelectModalSociety(soc.id)}
                />
              ))}
            </View>

            {inviteSociety ? (
              <>
                <Text style={[styles.pickerSubheading, { marginTop: 10 }]}>2. Select Block:</Text>
                {loadingBlocks ? (
                  <ActivityIndicator size="small" color={C.accent} style={{ marginVertical: 6 }} />
                ) : blocksList.length > 0 ? (
                  <View style={styles.chipGrid}>
                    {blocksList.map((blk) => (
                      <Chip
                        key={blk.id}
                        label={`${blk.name} (${fmtBlkId(blk.id)})`}
                        active={String(inviteBlock) === String(blk.id)}
                        onPress={() => onSelectModalBlock(blk.id)}
                      />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyHintText}>No blocks found for this society.</Text>
                )}
              </>
            ) : null}

            {inviteBlock ? (
              <>
                <Text style={[styles.pickerSubheading, { marginTop: 10 }]}>3. Select Flat:</Text>
                {loadingFlats ? (
                  <ActivityIndicator size="small" color={C.accent} style={{ marginVertical: 6 }} />
                ) : flatsList.length > 0 ? (
                  <View style={styles.chipGrid}>
                    {flatsList.map((fl) => (
                      <Chip
                        key={fl.id}
                        label={`Flat ${fl.flat_number} (${fmtFltId(fl.id)})`}
                        active={String(inviteFlat) === String(fl.id)}
                        onPress={() => setInviteFlat(String(fl.id))}
                      />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyHintText}>No flats found for this block.</Text>
                )}
              </>
            ) : null}
          </View>
        )}

        {/* Confirmation Summary Card before sending */}
        {inviteEmail.trim() ? (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Invitation Summary</Text>
            <Text style={styles.confirmRow}>Recipient: <Text style={styles.confirmVal}>{inviteEmail}</Text></Text>
            <Text style={styles.confirmRow}>Role: <Text style={styles.confirmVal}>{inviteRole}</Text></Text>
            {inviteSociety && selectedSoc ? (
              <Text style={styles.confirmRow}>Society: <Text style={styles.confirmVal}>{selectedSoc.society_name} ({fmtSocId(selectedSoc.id)})</Text></Text>
            ) : null}
            {inviteRole === 'Guardian' && inviteFlat && selectedFlt ? (
              <>
                <Text style={styles.confirmRow}>Block: <Text style={styles.confirmVal}>{selectedBlk?.name} ({fmtBlkId(selectedBlk?.id)})</Text></Text>
                <Text style={styles.confirmRow}>Flat: <Text style={styles.confirmVal}>#{selectedFlt.flat_number} ({fmtFltId(selectedFlt.id)})</Text></Text>
              </>
            ) : null}
          </View>
        ) : null}
      </ActionModal>
    </View>
  );
}

const styles = StyleSheet.create({
  topTabsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    paddingHorizontal: SPACE.lg,
  },
  topTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginRight: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    gap: 6,
  },
  topTabBtnActive: {
    borderBottomColor: C.accent,
  },
  topTabText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: C.muted,
  },
  topTabTextActive: {
    color: C.accent,
  },
  filterScroll: {
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.lineLight,
  },
  userCard: {
    padding: SPACE.md,
    marginBottom: SPACE.sm,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
  },
  youBadge: {
    backgroundColor: C.safeSoft,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.pill,
  },
  youBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: C.safeInk,
  },
  userEmail: {
    fontSize: 12.5,
    color: C.muted,
    marginTop: 2,
  },
  userPhone: {
    fontSize: 11.5,
    color: C.ink3,
    marginTop: 2,
  },
  userHierarchy: {
    fontSize: 11.5,
    color: C.accentInk,
    fontWeight: '600',
    marginTop: 4,
  },
  rolePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    marginLeft: 6,
  },
  rolePillText: {
    fontWeight: '800',
    fontSize: 11,
  },
  cardActions: {
    marginTop: SPACE.sm,
    paddingTop: SPACE.sm,
    borderTopWidth: 1,
    borderTopColor: C.lineLight,
    alignItems: 'flex-end',
  },
  inviteCard: {
    padding: SPACE.md,
    marginBottom: SPACE.sm,
  },
  inviteEmail: {
    fontSize: 14.5,
    fontWeight: '800',
    color: C.ink,
  },
  inviteMeta: {
    fontSize: 12,
    color: C.muted,
    marginTop: 3,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusUsed: {
    backgroundColor: '#F1F5F9',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  inviteHierarchyBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.lineLight,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  inviteHierarchyText: {
    fontSize: 11.5,
    color: C.ink2,
    fontWeight: '600',
  },
  inviteDateText: {
    fontSize: 10.5,
    color: C.muted,
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: C.ink2,
    marginBottom: 8,
  },
  modalPickerArea: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: SPACE.md,
  },
  pickerSubheading: {
    fontSize: 12,
    fontWeight: '700',
    color: C.ink,
    marginBottom: 6,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  emptyHintText: {
    fontSize: 11.5,
    color: C.muted,
    fontStyle: 'italic',
  },
  confirmBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: RADIUS.sm,
    padding: 12,
    marginTop: SPACE.xs,
  },
  confirmTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.accent,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  confirmRow: {
    fontSize: 12,
    color: C.ink2,
    marginBottom: 3,
  },
  confirmVal: {
    fontWeight: '700',
    color: C.ink,
  },
});