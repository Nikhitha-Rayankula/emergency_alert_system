import React from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { C, RADIUS, SPACE, Btn } from '../ui';

export default function ActionModal({
  visible,
  onClose,
  title,
  subtitle,
  children,
  submitText = 'Confirm',
  onSubmit,
  loading = false,
  submitKind = 'primary',
  danger = false,
}) {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 16);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: bottomPadding }]}>
          <View style={styles.handle} />
          
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={C.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>

          {onSubmit && (
            <View style={styles.footer}>
              <Btn
                title={submitText}
                onPress={onSubmit}
                loading={loading}
                kind={danger ? 'sos' : submitKind}
                style={{ flex: 1 }}
              />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.md,
    borderBottomWidth: 1,
    borderBottomColor: C.lineLight,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: C.ink,
  },
  sub: {
    fontSize: 12.5,
    color: C.muted,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACE.md,
  },
  content: {
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.md,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.md,
    borderTopWidth: 1,
    borderTopColor: C.lineLight,
  },
});
