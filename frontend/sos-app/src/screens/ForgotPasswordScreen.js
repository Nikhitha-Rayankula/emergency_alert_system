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
import { Card, Btn, Field, PasswordField, C, SPACE, RADIUS } from '../ui';
import api, { errorText } from '../api';
import { useAuth } from '../AuthContext';
import { useToast } from '../Toast';

export default function ForgotPasswordScreen({ navigation }) {
  const toast = useToast();
  const { user } = useAuth();

  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password, 4: Success
  const [email, setEmail] = useState(user?.email || '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleReturnToLogin = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else if (!user) {
      navigation.navigate('Login');
    }
  };

  // Validate email format
  const isValidEmail = (val) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(val);
  };

  // Step 1: Request Password Reset OTP
  const handleRequestOTP = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      Alert.alert('Email Required', 'Please enter your registered email address.');
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setBusy(true);
    try {
      // Call existing backend OTP endpoint for password reset
      await api.post('/send-otp/', {
        email: trimmedEmail,
        purpose: 'forgot_password',
      });

      toast('Reset code sent to your email!', 'success');
      setStep(2);
    } catch (e) {
      Alert.alert('Request Failed', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = () => {
    const trimmedOtp = otp.trim();
    if (!trimmedOtp) {
      Alert.alert('Code Required', 'Please enter the 6-digit OTP code sent to your email.');
      return;
    }
    if (trimmedOtp.length !== 6) {
      Alert.alert('Invalid Code', 'The verification code must be exactly 6 digits.');
      return;
    }

    toast('Code entered! Please create your new password.', 'success');
    setStep(3);
  };

  // Resend OTP
  const handleResendOTP = async () => {
    setBusy(true);
    try {
      await api.post('/send-otp/', {
        email: email.trim(),
        purpose: 'forgot_password',
      });
      toast('A fresh password reset code has been sent.', 'info');
    } catch (e) {
      Alert.alert('Could Not Resend', errorText(e));
    } finally {
      setBusy(false);
    }
  };

  // Step 3: Reset to New Password
  const handleResetPassword = async () => {
    if (!newPassword) {
      Alert.alert('Password Required', 'Please enter your new password.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Password Too Short', 'Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Password Mismatch', 'The passwords you entered do not match. Please verify and try again.');
      return;
    }

    setBusy(true);
    try {
      // Call backend reset password endpoint
      await api.post('/reset-password/', {
        email: email.trim(),
        otp: otp.trim(),
        new_password: newPassword,
      });

      setStep(4);
    } catch (e) {
      // If endpoint returned error
      Alert.alert('Reset Failed', errorText(e));
    } finally {
      setBusy(false);
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
          {/* Top Header / Progress Indicator */}
          <View style={styles.headerArea}>
            <View style={styles.iconCircle}>
              <Ionicons
                name={
                  step === 1
                    ? 'key-outline'
                    : step === 2
                      ? 'mail-unread-outline'
                      : step === 3
                        ? 'lock-closed-outline'
                        : 'checkmark-circle'
                }
                size={30}
                color={step === 4 ? C.safeDark : C.sos}
              />
            </View>

            <Text style={styles.headerTitle}>
              {step === 1 && 'Forgot Password'}
              {step === 2 && 'Verify Reset Code'}
              {step === 3 && 'Set New Password'}
              {step === 4 && 'Password Reset Complete'}
            </Text>

            <Text style={styles.headerSub}>
              {step === 1 && 'Enter your registered email address to receive a password reset verification code.'}
              {step === 2 && `Enter the 6-digit verification code sent to ${email}`}
              {step === 3 && 'Create a strong new password with at least 8 characters.'}
              {step === 4 && 'Your password has been successfully updated. You can now sign in with your new credentials.'}
            </Text>

            {/* Step Indicators */}
            {step < 4 && (
              <View style={styles.stepIndicatorRow}>
                <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]}>
                  <Text style={[styles.stepDotText, step >= 1 && styles.stepDotTextActive]}>1</Text>
                </View>
                <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
                <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]}>
                  <Text style={[styles.stepDotText, step >= 2 && styles.stepDotTextActive]}>2</Text>
                </View>
                <View style={[styles.stepLine, step >= 3 && styles.stepLineActive]} />
                <View style={[styles.stepDot, step >= 3 && styles.stepDotActive]}>
                  <Text style={[styles.stepDotText, step >= 3 && styles.stepDotTextActive]}>3</Text>
                </View>
              </View>
            )}
          </View>

          {/* Step Form Card */}
          <Card style={styles.formCard}>
            {step === 1 && (
              <>
                <Field
                  label="Registered Email Address"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="you@example.com"
                />

                <Btn
                  title="Send Verification Code"
                  onPress={handleRequestOTP}
                  loading={busy}
                  icon={<Ionicons name="paper-plane" size={16} color="#fff" />}
                  style={{ marginTop: 6 }}
                />

                <Btn
                  kind="ghost"
                  title={user ? "Back" : "Back to Sign In"}
                  onPress={handleReturnToLogin}
                  style={{ marginTop: 10 }}
                />
              </>
            )}

            {step === 2 && (
              <>
                <Field
                  label="6-Digit Verification Code"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="123456"
                  style={{ textAlign: 'center', fontSize: 18, letterSpacing: 4 }}
                />

                <Btn
                  title="Verify Code & Continue"
                  onPress={handleVerifyOTP}
                  loading={busy}
                  icon={<Ionicons name="checkmark-circle" size={17} color="#fff" />}
                  style={{ marginTop: 6 }}
                />

                <Btn
                  kind="ghost"
                  title="Resend Verification Code"
                  onPress={handleResendOTP}
                  loading={busy}
                  style={{ marginTop: 10 }}
                />

                <TouchableOpacity
                  style={styles.backStepLink}
                  onPress={() => setStep(1)}
                >
                  <Text style={styles.backStepText}>← Change email address</Text>
                </TouchableOpacity>
              </>
            )}

            {step === 3 && (
              <>
                <PasswordField
                  label="New Password (min 8 characters)"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                />

                <PasswordField
                  label="Confirm New Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter new password"
                />

                <Btn
                  title="Update Password"
                  onPress={handleResetPassword}
                  loading={busy}
                  icon={<Ionicons name="lock-closed" size={16} color="#fff" />}
                  style={{ marginTop: 6 }}
                />

                <Btn
                  kind="ghost"
                  title={user ? "Cancel" : "Cancel & Return to Login"}
                  onPress={handleReturnToLogin}
                  style={{ marginTop: 10 }}
                />
              </>
            )}

            {step === 4 && (
              <View style={{ alignItems: 'center', paddingVertical: SPACE.md }}>
                <View style={styles.successIconWrap}>
                  <Ionicons name="checkmark" size={36} color="#FFFFFF" />
                </View>

                <Text style={styles.successTitle}>Password Changed!</Text>
                <Text style={styles.successSub}>
                  You can now log in using your newly configured password.
                </Text>

                <Btn
                  title={user ? "Done" : "Proceed to Sign In"}
                  onPress={handleReturnToLogin}
                  icon={<Ionicons name={user ? "checkmark" : "log-in"} size={17} color="#fff" />}
                  style={{ width: '100%', marginTop: SPACE.lg }}
                />
              </View>
            )}
          </Card>

          {step < 4 && (
            <TouchableOpacity
              style={styles.loginLink}
              onPress={handleReturnToLogin}
            >
              <Text style={styles.loginLinkText}>
                {user ? (
                  <Text style={{ fontWeight: '800', color: C.accent }}>← Back</Text>
                ) : (
                  <>Remember your password? <Text style={{ fontWeight: '800', color: C.accent }}>Sign In</Text></>
                )}
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
    alignItems: 'center',
    marginBottom: SPACE.lg,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.md,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: C.line,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: C.ink,
    textAlign: 'center',
  },
  headerSub: {
    fontSize: 13,
    color: C.muted,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: SPACE.md,
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACE.lg,
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: C.sos,
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: '800',
    color: C.muted,
  },
  stepDotTextActive: {
    color: '#FFFFFF',
  },
  stepLine: {
    width: 32,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: C.sos,
  },
  formCard: {
    padding: SPACE.xl,
    marginBottom: SPACE.lg,
  },
  backStepLink: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 6,
  },
  backStepText: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.safeDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.md,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: C.ink,
  },
  successSub: {
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
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
