import React, { createContext, useContext, useRef, useState } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C, RADIUS } from './ui';

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

const TONE = {
  success: { bg: C.safe, fg: '#fff' },
  error: { bg: C.sos, fg: '#fff' },
  info: { bg: C.ink, fg: '#fff' },
};

export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null);
  const [tone, setTone] = useState('info');
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  const show = (text, t = 'info') => {
    setMsg(text);
    setTone(t);
    clearTimeout(timer.current);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 18 }).start();
    timer.current = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setMsg(null));
    }, 2600);
  };

  const c = TONE[tone] || TONE.info;

  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg ? (
        <SafeAreaView pointerEvents="none" style={styles.wrap} edges={['top']}>
          <Animated.View
            style={[
              styles.toast,
              { backgroundColor: c.bg, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }] },
            ]}
          >
            <Text style={{ color: c.fg, fontWeight: '600', fontSize: 13.5 }}>{msg}</Text>
          </Animated.View>
        </SafeAreaView>
      ) : null}
    </ToastCtx.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', zIndex: 999 },
  toast: { marginTop: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: RADIUS.md, maxWidth: '90%', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
});