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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card, Btn, Field, Chip, C, SPACE, RADIUS } from '../ui';
import api, { errorText } from '../api';
import { useToast } from '../Toast';

const ROLES = ['Resident', 'Guardian', 'Volunteer'];

export default function RegisterScreen({ navigation }) {
  const toast = useToast();
  const [f, setF] = useState({
    username: '',
    email: '',
    mobile: '',
    password: '',
    society: '',
    flat: '',
  });
  const [societiesList, setSocietiesList] = useState([]);
  const [role, setRole] = useState('Resident');
  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/gated-society/').catch(() => ({ data: [] }));
        const list = Array.isArray(data) ? data : (data ? [data] : []);
        setSocietiesList(list);
        if (list.length > 0) {
          setF((prev) => ({
            ...prev,
            society: prev.society || String(list[0].id),
            flat: prev.flat || '1',
          }));
        }
      } catch (e) {
        // Fallback
      }
    })();
  }, []);

  const set = (k) => (v) => setF((prev) => ({ ...prev, [k]: v }));

  const register = async () => {
    if (!f.username.trim() || !f.email.trim() || !f.password) {
      Alert.alert('Required Fields', 'Please complete all required fields (username, email, password).');
      return;
    }
    if (f.password.length < 8) {
      Alert.alert('Password Too Short', 'Password must be at least 8 characters long.');
      return;
    }
    if (role === 'Resident' && (!f.society || !f.flat)) {
      Alert.alert('Resident Info Required', 'Please provide a valid Gated Society ID and Flat ID.');
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
            {step === 1 ? 'Create Account' : 'Verify Email OTP'}
          </Text>
          <Text style={styles.headerSub}>
            {step === 1
              ? 'Join your community emergency response network'
              : `Enter the 6-digit code sent to ${f.email}`}
          </Text>
        </View>

        <Card style={styles.formCard}>
          {step === 1 ? (
            <>
              <Field
                label="Username"
                value={f.username}
                onChangeText={set('username')}
                placeholder="Choose a username"
              />

              <Field
                label="Email Address"
                value={f.email}
                onChangeText={set('email')}
                keyboardType="email-address"
                placeholder="you@example.com"
              />

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
                  <Text style={[styles.roleLabel, { marginBottom: 6 }]}>Gated Society:</Text>
                  {societiesList.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                      {societiesList.map((soc) => (
                        <Chip
                          key={soc.id}
                          label={`ID ${soc.id}: ${soc.society_name}`}
                          active={String(f.society) === String(soc.id)}
                          onPress={() => set('society')(String(soc.id))}
                        />
                      ))}
                    </View>
                  )}
                  <Field
                    label="Gated Society ID"
                    value={f.society}
                    onChangeText={set('society')}
                    keyboardType="number-pad"
                    placeholder="e.g. 6"
                    hint="Enter your community Society ID"
                  />
                  <Field
                    label="Flat ID"
                    value={f.flat}
                    onChangeText={set('flat')}
                    keyboardType="number-pad"
                    placeholder="e.g. 1"
                    hint="Enter your assigned Flat ID"
                  />
                </View>
              )}

              <Btn
                title="Create Account"
                onPress={register}
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
                style={{ textAlign: 'center' }}
              />

              <Btn
                title="Verify & Activate"
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
    paddingTop: 30,
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