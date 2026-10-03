import React, { useState, useEffect } from 'react';
import {
  Text,
  View,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, Btn, Field, Chip, C, SPACE, RADIUS, IdBadge, HierarchySummary, fmtSocId, fmtBlkId, fmtFltId } from '../ui';
import api, { errorText } from '../api';
import { useToast } from '../Toast';

const ROLES = ['Resident', 'Guardian', 'Volunteer'];

export default function RegisterScreen({ navigation, route }) {
  const toast = useToast();
  const tokenParam = route?.params?.token || route?.params?.inviteToken || '';

  // Form state
  const [f, setF] = useState({
    username: '',
    email: '',
    mobile: '',
    password: '',
    society: '',
    block: '',
    flat: '',
  });

  // Role & registration mode
  const [role, setRole] = useState('Resident');
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);

  // Invite state
  const [inviteToken, setInviteToken] = useState(tokenParam);
  const [inviteMeta, setInviteMeta] = useState(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');

  // Dropdown / dependent selection lists
  const [societiesList, setSocietiesList] = useState([]);
  const [blocksList, setBlocksList] = useState([]);
  const [flatsList, setFlatsList] = useState([]);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [loadingFlats, setLoadingFlats] = useState(false);

  // Check if token exists in params or if user enters invite token
  useEffect(() => {
    if (tokenParam) {
      setInviteToken(tokenParam);
      loadInvite(tokenParam);
    } else {
      loadSocieties();
    }
  }, [tokenParam]);

  const loadSocieties = async () => {
    try {
      const { data } = await api.get('/gated-society/');
      const list = Array.isArray(data) ? data : (data?.results || (data ? [data] : []));
      setSocietiesList(list);
    } catch (e) {
      // Non-critical if offline
    }
  };

  const loadInvite = async (tok) => {
    if (!tok) return;
    setInviteLoading(true);
    setInviteError('');
    try {
      const { data } = await api.get(`/register/invite/${tok}/`, {
        headers: { Accept: 'application/json' },
      });
      if (data && data.valid) {
        setInviteMeta(data);
        setRole(data.role || 'Resident');
        setF((prev) => ({
          ...prev,
          email: data.email || prev.email,
          society: data.society_id ? String(data.society_id) : '',
          block: data.block_id ? String(data.block_id) : '',
          flat: data.flat_id ? String(data.flat_id) : '',
        }));
      } else {
        setInviteError(data?.detail || 'This invitation link is invalid or has expired.');
      }
    } catch (e) {
      setInviteError(errorText(e) || 'Failed to validate invitation link.');
    }
    setInviteLoading(false);
  };

  // When society changes, load its blocks
  const onSelectSociety = async (socId) => {
    setF((prev) => ({ ...prev, society: String(socId), block: '', flat: '' }));
    setBlocksList([]);
    setFlatsList([]);
    if (!socId) return;

    setLoadingBlocks(true);
    try {
      const { data } = await api.get(`/societies/${socId}/blocks/`);
      const list = Array.isArray(data) ? data : (data?.results || (data ? [data] : []));
      setBlocksList(list);
    } catch (e) {
      // Ignore
    }
    setLoadingBlocks(false);
  };

  // When block changes, load its flats
  const onSelectBlock = async (blkId) => {
    setF((prev) => ({ ...prev, block: String(blkId), flat: '' }));
    setFlatsList([]);
    if (!blkId) return;

    setLoadingFlats(true);
    try {
      const { data } = await api.get(`/blocks/${blkId}/flats/`);
      const list = Array.isArray(data) ? data : (data?.results || (data ? [data] : []));
      setFlatsList(list);
    } catch (e) {
      // Ignore
    }
    setLoadingFlats(false);
  };

  const onSelectFlat = (fltId) => {
    setF((prev) => ({ ...prev, flat: String(fltId) }));
  };

  const set = (k) => (v) => setF((prev) => ({ ...prev, [k]: v }));

  // Register via Invitation Token
  const registerInvite = async () => {
    if (!f.username.trim() || !f.password) {
      Alert.alert('Required Fields', 'Please choose a username and enter a password.');
      return;
    }
    if (f.password.length < 8) {
      Alert.alert('Password Too Short', 'Password must be at least 8 characters long.');
      return;
    }

    setBusy(true);
    try {
      await api.post('/register/invite/', {
        token: inviteToken,
        username: f.username.trim(),
        mobile: f.mobile.trim(),
        password: f.password,
      });
      Alert.alert(
        'Account Created 🎉',
        'Your account has been registered and verified successfully. You can now log in.',
        [{ text: 'Log In Now', onPress: () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login')) }]
      );
    } catch (e) {
      Alert.alert('Registration Failed', errorText(e));
    }
    setBusy(false);
  };

  // Standard Self-Registration (sends OTP)
  const registerStandard = async () => {
    if (!f.username.trim() || !f.email.trim() || !f.password) {
      Alert.alert('Required Fields', 'Please complete all required fields (username, email, password).');
      return;
    }
    if (f.password.length < 8) {
      Alert.alert('Password Too Short', 'Password must be at least 8 characters long.');
      return;
    }
    if (role === 'Resident' && (!f.society || !f.flat)) {
      Alert.alert('Selection Required', 'Please select your Society, Block, and Flat.');
      return;
    }

    setBusy(true);
    try {
      const body = {
        username: f.username.trim(),
        email: f.email.trim(),
        mobile: f.mobile.trim(),
        password: f.password,
        group_name: role,
      };

      if (role === 'Resident') {
        body.gated_society = Number(f.society);
        body.flat = Number(f.flat);
      }

      await api.post('/register/', body);
      toast('Verification code sent to your email!', 'success');
      setStep(2);
    } catch (e) {
      Alert.alert('Registration Failed', errorText(e));
    }
    setBusy(false);
  };

  // Verify OTP
  const verify = async () => {
    if (!otp.trim()) {
      Alert.alert('Code Required', 'Please enter the 6-digit OTP code sent to your email.');
      return;
    }

    setBusy(true);
    try {
      await api.post('/verify-otp/', { email: f.email.trim(), otp: otp.trim() });
      Alert.alert(
        'Account Activated 🎉',
        'Your registration is verified. You can now log in to the Community Emergency Response Platform.',
        [{ text: 'Proceed to Login', onPress: () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login')) }]
      );
    } catch (e) {
      Alert.alert('Verification Failed', errorText(e));
    }
    setBusy(false);
  };

  const resend = async () => {
    try {
      await api.post('/send-otp/', { email: f.email.trim(), purpose: 'registration' });
      toast('A fresh verification code has been dispatched', 'info');
    } catch (e) {
      Alert.alert('Could Not Resend', errorText(e));
    }
  };

  // Selected names for live preview
  const selectedSoc = societiesList.find((s) => String(s.id) === String(f.society));
  const selectedBlk = blocksList.find((b) => String(b.id) === String(f.block));
  const selectedFlt = flatsList.find((fl) => String(fl.id) === String(f.flat));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerArea}>
            <Text style={styles.headerTitle}>
              {step === 1
                ? (inviteMeta ? 'Complete Invitation' : 'Create Account')
                : 'Verify Email OTP'}
            </Text>
            <Text style={styles.headerSub}>
              {step === 1
                ? (inviteMeta
                    ? `You are joining as ${inviteMeta.role || 'Resident'}`
                    : 'Join your community emergency response network')
                : `Enter the 6-digit code sent to ${f.email}`}
            </Text>
          </View>

          {/* Invitation Loading */}
          {inviteLoading && (
            <Card style={[styles.formCard, { alignItems: 'center', paddingVertical: 30 }]}>
              <ActivityIndicator size="large" color={C.accent} />
              <Text style={{ marginTop: 12, color: C.muted, fontWeight: '600' }}>
                Validating invitation link...
              </Text>
            </Card>
          )}

          {/* Invitation Error Banner */}
          {inviteError ? (
            <Card style={[styles.formCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Ionicons name="alert-circle" size={24} color={C.sos} />
                <Text style={{ fontSize: 15, fontWeight: '800', color: C.sos }}>
                  Invitation Issue
                </Text>
              </View>
              <Text style={{ color: '#991B1B', fontSize: 13, lineHeight: 18, marginBottom: 12 }}>
                {inviteError}
              </Text>
              <Btn
                kind="outline"
                size="sm"
                title="Continue with Standard Registration"
                onPress={() => {
                  setInviteToken('');
                  setInviteMeta(null);
                  setInviteError('');
                  loadSocieties();
                }}
              />
            </Card>
          ) : null}

          {/* Main Card */}
          {!inviteLoading && (
            <Card style={styles.formCard}>
              {step === 1 ? (
                <>
                  {/* If Invite is valid, show Organization Context Card */}
                  {inviteMeta ? (
                    <View style={{ marginBottom: SPACE.lg }}>
                      <HierarchySummary
                        societyName={inviteMeta.society_name}
                        societyId={inviteMeta.society_id}
                        blockName={inviteMeta.block_name}
                        blockId={inviteMeta.block_id}
                        flatNumber={inviteMeta.flat_number}
                        flatId={inviteMeta.flat_id}
                        role={inviteMeta.role}
                        email={inviteMeta.email}
                      />
                    </View>
                  ) : null}

                  {/* Account credentials */}
                  <Field
                    label="Username"
                    value={f.username}
                    onChangeText={set('username')}
                    placeholder="Choose a username (e.g. rahul_s)"
                    autoCapitalize="none"
                  />

                  {/* If standard registration, email is editable */}
                  {!inviteMeta ? (
                    <Field
                      label="Email Address"
                      value={f.email}
                      onChangeText={set('email')}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholder="you@example.com"
                    />
                  ) : null}

                  <Field
                    label="Mobile Phone"
                    value={f.mobile}
                    onChangeText={set('mobile')}
                    keyboardType="phone-pad"
                    placeholder="+91 9876543210"
                  />

                  <Field
                    label="Password (min 8 chars)"
                    value={f.password}
                    onChangeText={set('password')}
                    secureTextEntry
                    placeholder="Create a password"
                  />

                  {/* If NOT an invite, show Role Picker & Dependent Dropdowns */}
                  {!inviteMeta ? (
                    <>
                      <Text style={styles.roleLabel}>I am registering as:</Text>
                      <View style={styles.roleRow}>
                        {ROLES.map((r) => (
                          <Chip
                            key={r}
                            label={r}
                            active={role === r}
                            onPress={() => setRole(r)}
                          />
                        ))}
                      </View>

                      {role === 'Resident' && (
                        <View style={styles.residentFields}>
                          <Text style={styles.sectionHeading}>
                            📍 Select Your Residence Hierarchy
                          </Text>

                          {/* Step 1: Select Society */}
                          <Text style={styles.subLabel}>Step 1: Choose Society</Text>
                          {societiesList.length > 0 ? (
                            <View style={styles.chipGrid}>
                              {societiesList.map((soc) => (
                                <Chip
                                  key={soc.id}
                                  label={`${soc.society_name} (${fmtSocId(soc.id)})`}
                                  active={String(f.society) === String(soc.id)}
                                  onPress={() => onSelectSociety(soc.id)}
                                />
                              ))}
                            </View>
                          ) : (
                            <Text style={styles.emptyText}>Loading societies...</Text>
                          )}

                          {/* Step 2: Select Block */}
                          {f.society ? (
                            <>
                              <Text style={[styles.subLabel, { marginTop: 12 }]}>
                                Step 2: Choose Block in {selectedSoc?.society_name || `Society #${f.society}`}
                              </Text>
                              {loadingBlocks ? (
                                <ActivityIndicator size="small" color={C.accent} style={{ marginVertical: 8 }} />
                              ) : blocksList.length > 0 ? (
                                <View style={styles.chipGrid}>
                                  {blocksList.map((blk) => (
                                    <Chip
                                      key={blk.id}
                                      label={`${blk.name} (${fmtBlkId(blk.id)})`}
                                      active={String(f.block) === String(blk.id)}
                                      onPress={() => onSelectBlock(blk.id)}
                                    />
                                  ))}
                                </View>
                              ) : (
                                <Text style={styles.emptyText}>No blocks found for this society.</Text>
                              )}
                            </>
                          ) : null}

                          {/* Step 3: Select Flat */}
                          {f.block ? (
                            <>
                              <Text style={[styles.subLabel, { marginTop: 12 }]}>
                                Step 3: Choose Flat in {selectedBlk?.name || `Block #${f.block}`}
                              </Text>
                              {loadingFlats ? (
                                <ActivityIndicator size="small" color={C.accent} style={{ marginVertical: 8 }} />
                              ) : flatsList.length > 0 ? (
                                <View style={styles.chipGrid}>
                                  {flatsList.map((fl) => (
                                    <Chip
                                      key={fl.id}
                                      label={`Flat ${fl.flat_number} (${fmtFltId(fl.id)})`}
                                      active={String(f.flat) === String(fl.id)}
                                      onPress={() => onSelectFlat(fl.id)}
                                    />
                                  ))}
                                </View>
                              ) : (
                                <Text style={styles.emptyText}>No flats found for this block.</Text>
                              )}
                            </>
                          ) : null}

                          {/* Live Selection Summary */}
                          {f.society && f.flat ? (
                            <View style={styles.selectionSummary}>
                              <Text style={styles.summaryTitle}>Selected Residence:</Text>
                              <Text style={styles.summaryValue}>
                                {selectedSoc?.society_name || `Society #${f.society}`} ({fmtSocId(f.society)}) →{' '}
                                {selectedBlk?.name || `Block #${f.block}`} ({fmtBlkId(f.block)}) →{' '}
                                Flat {selectedFlt?.flat_number || f.flat} ({fmtFltId(f.flat)})
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      )}
                    </>
                  ) : null}

                  <Btn
                    title={inviteMeta ? 'Complete Registration' : 'Create Account'}
                    onPress={inviteMeta ? registerInvite : registerStandard}
                    loading={busy}
                    icon={<Ionicons name="arrow-forward" size={17} color="#fff" />}
                    style={{ marginTop: 8 }}
                  />
                </>
              ) : (
                <>
                  <View style={styles.otpIconWrap}>
                    <Ionicons name="mail-unread" size={32} color={C.accent} />
                  </View>

                  <Field
                    label="6-Digit Verification Code"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="123456"
                    style={{ textAlign: 'center', letterSpacing: 4, fontSize: 20, fontWeight: '700' }}
                  />

                  <Btn
                    title="Verify & Activate Account"
                    onPress={verify}
                    loading={busy}
                    icon={<Ionicons name="checkmark-circle" size={18} color="#fff" />}
                  />

                  <Btn
                    kind="ghost"
                    title="Resend Code"
                    onPress={resend}
                    style={{ marginTop: 10 }}
                  />
                </>
              )}
            </Card>
          )}

          {step === 1 && (
            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Login'))}
            >
              <Text style={styles.loginLinkText}>
                Already registered? <Text style={{ fontWeight: '800', color: C.accent }}>Log In</Text>
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: SPACE.xl,
    paddingTop: 20,
    flexGrow: 1,
    justifyContent: 'center',
  },
  headerArea: {
    marginBottom: SPACE.lg,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: C.ink,
  },
  headerSub: {
    fontSize: 13,
    color: C.muted,
    marginTop: 3,
  },
  formCard: {
    padding: SPACE.xl,
    marginBottom: SPACE.lg,
  },
  roleLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: C.ink2,
    marginBottom: 8,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: SPACE.md,
  },
  residentFields: {
    backgroundColor: '#F8FAFC',
    padding: SPACE.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: C.line,
    marginBottom: SPACE.md,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: C.ink,
    marginBottom: 10,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: C.ink2,
    marginBottom: 6,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 12,
    color: C.muted,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  selectionSummary: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: RADIUS.sm,
    padding: 10,
    marginTop: 8,
  },
  summaryTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: C.accent,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: C.ink,
    marginTop: 2,
  },
  otpIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: SPACE.lg,
  },
  loginLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  loginLinkText: {
    color: C.muted,
    fontSize: 13.5,
  },
});