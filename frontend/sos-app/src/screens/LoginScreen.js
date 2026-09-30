import React, { useState } from 'react';
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
import { Card, Btn, Field, C, SPACE, RADIUS } from '../ui';
import { useAuth } from '../AuthContext';
import { errorText } from '../api';
import { useToast } from '../Toast';

export default function LoginScreen({ navigation }) {
  const toast = useToast();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Required', 'Please enter both your email address and password.');
      return;
    }

    setBusy(true);
    try {
      await login(email.trim(), password);
      toast('Signed in successfully', 'success');
    } catch (e) {
      Alert.alert('Login Failed', errorText(e));
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand Logo & Title */}
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <Ionicons name="shield" size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.appTitle}>CERP Emergency</Text>
            <Text style={styles.appSub}>Community Emergency Response Platform</Text>
          </View>

          {/* Login Form Card */}
          <Card style={styles.loginCard}>
            <Text style={styles.cardHeader}>Sign In to Your Account</Text>
            <Text style={styles.cardSub}>Enter your registered email and password</Text>

            <Field
              label="Email Address"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="you@example.com"
            />

            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Enter your password"
            />

            <View style={styles.forgotRow}>
              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                activeOpacity={0.7}
                style={styles.forgotBtn}
              >
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            <Btn
              title="Sign In"
              onPress={handleLogin}
              loading={busy}
              icon={<Ionicons name="log-in" size={17} color="#fff" />}
              style={{ marginTop: 4 }}
            />

            <Btn
              kind="ghost"
              title="Create New Resident / Volunteer Account"
              onPress={() => navigation.navigate('Register')}
              style={{ marginTop: 10 }}
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: SPACE.xl,
    paddingTop: 40,
    flexGrow: 1,
    justifyContent: 'center',
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: SPACE.xl,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: C.sos,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.sos,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    marginBottom: 12,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: C.ink,
    letterSpacing: -0.5,
  },
  appSub: {
    fontSize: 13,
    color: C.muted,
    marginTop: 3,
    fontWeight: '500',
  },
  loginCard: {
    padding: SPACE.xl,
    marginBottom: SPACE.xl,
  },
  cardHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: C.ink,
  },
  cardSub: {
    fontSize: 12.5,
    color: C.muted,
    marginTop: 2,
    marginBottom: SPACE.lg,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginBottom: SPACE.md,
    marginTop: -4,
  },
  forgotBtn: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  forgotText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: C.accent,
  },
});