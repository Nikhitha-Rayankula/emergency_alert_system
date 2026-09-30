import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../AuthContext';
import api from '../api';
import { C, SPACE, RADIUS, getUserDisplayName } from '../ui';

export default function Header({ title, subtitle, right, onRefresh }) {
  const { user } = useAuth();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnread = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/');
      const count = data.filter((n) => !n.is_read).length;
      setUnreadCount(count);
    } catch (e) {
      // Ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUnread();
    }, [loadUnread])
  );

  const displayName = getUserDisplayName(user);
  const defaultTitle = `Hello, ${displayName} 👋`;

  const initials = (user?.username || 'U').substring(0, 2).toUpperCase();

  const getRoleColor = (role) => {
    switch (role) {
      case 'Admin': return { bg: C.purpleSoft, fg: C.purpleInk, text: 'Platform Admin' };
      case 'Sub Admin': return { bg: C.purpleSoft, fg: C.purpleInk, text: 'Society Admin' };
      case 'Security': return { bg: C.warnSoft, fg: C.warnInk, text: 'Security Staff' };
      case 'Volunteer': return { bg: C.safeSoft, fg: C.safeInk, text: 'Volunteer' };
      case 'Guardian': return { bg: C.accentSoft, fg: C.accentInk, text: 'Flat Guardian' };
      default: return { bg: C.accentSoft, fg: C.accentInk, text: 'Resident' };
    }
  };

  const roleMeta = getRoleColor(user?.group_name);

  // Safe area top padding calculation for Android and iOS devices
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 24 : 0) + 8;

  const handleOpenAlerts = () => {
    try {
      navigation.navigate('Alerts');
    } catch (e) {
      // Fallback
    }
  };

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={styles.leftRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={styles.infoCol}>
          <View style={styles.greetingRow}>
            <Text style={styles.greeting} numberOfLines={1} ellipsizeMode="tail">
              {title || defaultTitle}
            </Text>
            <View style={[styles.roleBadge, { backgroundColor: roleMeta.bg }]}>
              <Text style={[styles.roleBadgeText, { color: roleMeta.fg }]}>{roleMeta.text}</Text>
            </View>
          </View>
          <Text style={styles.sub} numberOfLines={1} ellipsizeMode="tail">
            {subtitle || (user?.gated_society ? `Society #${user.gated_society}` : 'Community Safety Network')}
          </Text>
        </View>
      </View>

      <View style={styles.rightRow}>
        {onRefresh && (
          <TouchableOpacity style={styles.iconBtn} onPress={onRefresh} activeOpacity={0.7}>
            <Ionicons name="refresh" size={18} color={C.ink2} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.iconBtn}
          onPress={handleOpenAlerts}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={19} color={C.ink2} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>

        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: C.lineLight,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
    minWidth: 0,
  },
  greeting: {
    fontSize: 16,
    fontWeight: '800',
    color: C.ink,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  roleBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    flexShrink: 0,
    alignSelf: 'center',
  },
  roleBadgeText: {
    fontWeight: '800',
    fontSize: 10,
  },
  sub: {
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
    fontWeight: '500',
    flexShrink: 1,
  },
  rightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.line,
    marginLeft: 6,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: C.sos,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
