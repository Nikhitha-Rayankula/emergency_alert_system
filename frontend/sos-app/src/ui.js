import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
export const isSmall = width < 360;

export const C = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  ink: '#0F172A',
  ink2: '#1E293B',
  ink3: '#334155',
  muted: '#64748B',
  faint: '#94A3B8',
  line: '#E2E8F0',
  lineLight: '#F1F5F9',
  
  // Emergency Red
  sos: '#EF4444',
  sosDark: '#DC2626',
  sosSoft: '#FEF2F2',
  sosInk: '#991B1B',
  
  // Safe Green
  safe: '#10B981',
  safeDark: '#059669',
  safeSoft: '#ECFDF5',
  safeInk: '#065F46',
  
  // Warning Amber
  warn: '#F59E0B',
  warnDark: '#D97706',
  warnSoft: '#FFFBEB',
  warnInk: '#92400E',
  
  // Tech Blue
  accent: '#2563EB',
  accentDark: '#1D4ED8',
  accentSoft: '#EFF6FF',
  accentInk: '#1E40AF',
  
  // Purple
  purple: '#7C3AED',
  purpleSoft: '#F5F3FF',
  purpleInk: '#5B21B6',
};

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
export const RADIUS = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, pill: 999 };

export const SHADOW = {
  sm: { shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  card: { shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  raised: { shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  sos: { shadowColor: '#EF4444', shadowOpacity: 0.35, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
};

export const CATEGORIES = [
  { key: 'medical', label: 'Medical Emergency', short: 'Medical', icon: 'heart-pulse', iconSet: 'mci', color: '#EF4444', bg: '#FEF2F2' },
  { key: 'fall', label: 'Fall / Accident', short: 'Fall Alert', icon: 'walk', iconSet: 'ion', color: '#F59E0B', bg: '#FFFBEB' },
  { key: 'security', label: 'Security Concern', short: 'Security', icon: 'shield-alert', iconSet: 'mci', color: '#7C3AED', bg: '#F5F3FF' },
  { key: 'other', label: 'Other Emergency', short: 'Other', icon: 'alert-circle', iconSet: 'ion', color: '#2563EB', bg: '#EFF6FF' },
];

export const getCategoryMeta = (k) => CATEGORIES.find((c) => c.key === k) || CATEGORIES[3];
export const catLabel = (k) => getCategoryMeta(k).label;

export function getUserDisplayName(user) {
  if (!user) return 'Member';
  if (user.first_name && user.first_name.trim()) {
    return user.first_name.trim();
  }
  if (user.name && user.name.trim()) {
    return user.name.trim();
  }
  if (user.full_name && user.full_name.trim()) {
    return user.full_name.trim();
  }
  if (user.username && user.username.trim()) {
    return user.username.trim();
  }
  if (user.email && user.email.trim()) {
    const emailPrefix = user.email.split('@')[0];
    return emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  }
  return 'Member';
}

// ---- Standardized Entity ID Formatters (Part 2 & Part 13) ----
export const fmtSocId = (id) => {
  if (!id && id !== 0) return 'SOC-???';
  const s = String(id).trim();
  return s.toUpperCase().startsWith('SOC-') ? s.toUpperCase() : `SOC-${s.padStart(3, '0')}`;
};

export const fmtBlkId = (id) => {
  if (!id && id !== 0) return 'BLK-???';
  const s = String(id).trim();
  return s.toUpperCase().startsWith('BLK-') ? s.toUpperCase() : `BLK-${s.padStart(3, '0')}`;
};

export const fmtFltId = (id) => {
  if (!id && id !== 0) return 'FLT-???';
  const s = String(id).trim();
  return s.toUpperCase().startsWith('FLT-') ? s.toUpperCase() : `FLT-${s.padStart(3, '0')}`;
};

export const fmtUsrId = (id) => {
  if (!id && id !== 0) return 'USR-???';
  const s = String(id).trim();
  return s.toUpperCase().startsWith('USR-') ? s.toUpperCase() : `USR-${s.padStart(3, '0')}`;
};

export const fmtInvId = (id) => {
  if (!id && id !== 0) return 'INV-???';
  const s = String(id).trim();
  return s.toUpperCase().startsWith('INV-') ? s.toUpperCase() : `INV-${s.padStart(3, '0')}`;
};

export const fmtSosId = (id) => {
  if (!id && id !== 0) return 'SOS-???';
  const s = String(id).trim();
  return s.startsWith('SOS') ? s : `SOS #${s}`;
};

export const IdBadge = ({ type, prefix, id, label, color, bg, style, size }) => {
  const kind = (prefix || type || 'id').toLowerCase();
  let displayId = id;
  if (kind.startsWith('soc')) displayId = fmtSocId(id);
  else if (kind.startsWith('blk')) displayId = fmtBlkId(id);
  else if (kind.startsWith('flt')) displayId = fmtFltId(id);
  else if (kind.startsWith('usr')) displayId = fmtUsrId(id);
  else if (kind.startsWith('inv')) displayId = fmtInvId(id);
  else if (kind.startsWith('sos')) displayId = fmtSosId(id);

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: bg || '#F1F5F9',
          paddingHorizontal: size === 'sm' ? 5 : 7,
          paddingVertical: size === 'sm' ? 2 : 3,
          borderRadius: RADIUS.xs,
          borderWidth: 1,
          borderColor: '#E2E8F0',
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      {label ? (
        <Text style={{ fontSize: size === 'sm' ? 9.5 : 10.5, fontWeight: '700', color: '#64748B', marginRight: 4 }}>
          {label}:
        </Text>
      ) : null}
      <Text
        style={{
          fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
          fontSize: size === 'sm' ? 10 : 11,
          fontWeight: '800',
          color: color || '#0F172A',
          letterSpacing: 0.3,
        }}
      >
        {displayId}
      </Text>
    </View>
  );
};

export const HierarchySummary = ({
  societyName,
  societyId,
  blockName,
  blockId,
  flatNumber,
  flatId,
  role,
  title = 'Entity Hierarchy Context',
  style,
}) => (
  <View
    style={[
      {
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: RADIUS.md,
        padding: SPACE.md,
        marginBottom: SPACE.md,
      },
      style,
    ]}
  >
    {title ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <Ionicons name="git-network-outline" size={16} color={C.accent} style={{ marginRight: 6 }} />
        <Text style={{ fontSize: 12.5, fontWeight: '800', color: C.ink, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {title}
        </Text>
      </View>
    ) : null}

    {societyName || societyId ? (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 12.5, color: '#64748B', fontWeight: '600' }}>Society:</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink, marginRight: 6 }}>
            {societyName || 'Assigned Society'}
          </Text>
          {societyId ? <IdBadge type="soc" id={societyId} /> : null}
        </View>
      </View>
    ) : null}

    {blockName || blockId ? (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 12.5, color: '#64748B', fontWeight: '600' }}>Block / Tower:</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink, marginRight: 6 }}>
            {blockName || 'Assigned Block'}
          </Text>
          {blockId ? <IdBadge type="blk" id={blockId} /> : null}
        </View>
      </View>
    ) : null}

    {flatNumber || flatId ? (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 12.5, color: '#64748B', fontWeight: '600' }}>Flat / Unit:</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: C.ink, marginRight: 6 }}>
            #{flatNumber || flatId}
          </Text>
          {flatId ? <IdBadge type="flt" id={flatId} /> : null}
        </View>
      </View>
    ) : null}

    {role ? (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
        <Text style={{ fontSize: 12.5, color: '#64748B', fontWeight: '600' }}>Role:</Text>
        <View style={{ backgroundColor: C.accentSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.pill }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: C.accentInk }}>{role}</Text>
        </View>
      </View>
    ) : null}
  </View>
);

export const fmt = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 24 * 60) return `${Math.round(diffMin / 60)}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

fmt.relTime = (iso) => fmt(iso);
fmt.date = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};
fmt.time = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? String(iso) : d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

export const Screen = ({ title, subtitle, right, roleBadge, children }) => (
  <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'left', 'right']}>
    {title ? (
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={s.h1} numberOfLines={1}>{title}</Text>
            {roleBadge ? (
              <View style={[s.rolePill, { backgroundColor: C.accentSoft, borderColor: C.accent + '33' }]}>
                <Text style={{ color: C.accentInk, fontWeight: '700', fontSize: 11 }}>{roleBadge}</Text>
              </View>
            ) : null}
          </View>
          {subtitle ? <Text style={s.sub} numberOfLines={2}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={{ marginLeft: SPACE.md }}>{right}</View> : null}
      </View>
    ) : null}
    {children}
  </SafeAreaView>
);

export const Card = ({ children, style, onPress, muted, borderTone }) => {
  const body = (
    <View
      style={[
        s.card,
        muted && { backgroundColor: '#F1F5F9', borderStyle: 'dashed' },
        borderTone && { borderLeftWidth: 4, borderLeftColor: borderTone },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress}>
      {body}
    </TouchableOpacity>
  );
};

const KIND_STYLE = {
  primary: { bg: C.ink, fg: '#fff', border: C.ink },
  sos: { bg: C.sos, fg: '#fff', border: C.sos, shadow: true },
  safe: { bg: C.safe, fg: '#fff', border: C.safe },
  soft: { bg: C.accentSoft, fg: C.accentInk, border: C.accentSoft },
  ghost: { bg: '#FFFFFF', fg: C.ink2, border: C.line },
  dangerGhost: { bg: C.sosSoft, fg: C.sosInk, border: C.sos + '40' },
  purple: { bg: C.purple, fg: '#fff', border: C.purple },
};

export const Btn = ({ title, onPress, kind = 'primary', loading, disabled, style, small, icon }) => {
  const k = KIND_STYLE[kind] || KIND_STYLE.primary;
  const off = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={off}
      activeOpacity={0.82}
      style={[
        s.btn,
        small && s.btnSmall,
        { backgroundColor: k.bg, borderWidth: 1.2, borderColor: k.border, opacity: off ? 0.55 : 1 },
        k.shadow && !off && SHADOW.raised,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={k.fg} size="small" />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          {icon ? <View style={{ marginRight: 6 }}>{icon}</View> : null}
          <Text style={[s.btnText, small && { fontSize: 13 }, { color: k.fg }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export const Field = ({ label, error, hint, style, ...props }) => (
  <View style={[{ marginBottom: SPACE.md }, style]}>
    {label ? <Text style={s.label}>{label}</Text> : null}
    <TextInput
      placeholderTextColor={C.faint}
      autoCapitalize="none"
      style={[s.input, error && { borderColor: C.sos, backgroundColor: C.sosSoft }]}
      {...props}
    />
    {error ? <Text style={s.errorText}>{error}</Text> : hint ? <Text style={s.hintText}>{hint}</Text> : null}
  </View>
);

export const Chip = ({ label, active, onPress, tone = 'ink', icon }) => {
  const activeBg = tone === 'sos' ? C.sos : C.ink;
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        s.chip,
        active && { backgroundColor: activeBg, borderColor: activeBg },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {icon ? <View style={{ marginRight: 5 }}>{icon}</View> : null}
        <Text style={{ color: active ? '#fff' : C.ink3, fontWeight: '700', fontSize: 13 }}>{label}</Text>
      </View>
    </TouchableOpacity>
  );
};

const STATUS = {
  open: { bg: C.sosSoft, fg: C.sosInk, text: 'Open Alert', dot: C.sos },
  escalated: { bg: C.warnSoft, fg: C.warnInk, text: 'Escalated', dot: C.warn },
  active_response: { bg: C.accentSoft, fg: C.accentInk, text: 'Responding', dot: C.accent },
  resolved: { bg: C.safeSoft, fg: C.safeInk, text: 'Resolved', dot: C.safe },
  closed: { bg: '#F1F5F9', fg: C.muted, text: 'Closed', dot: C.muted },
  cancelled: { bg: '#F1F5F9', fg: C.muted, text: 'Cancelled', dot: C.muted },
};

export const StatusBadge = ({ status, small }) => {
  const st = STATUS[status] || { bg: '#F1F5F9', fg: C.muted, text: status || 'Unknown', dot: C.muted };
  return (
    <View
      style={{
        backgroundColor: st.bg,
        paddingHorizontal: small ? 8 : 10,
        paddingVertical: small ? 3 : 5,
        borderRadius: RADIUS.pill,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: st.dot, marginRight: 6 }} />
      <Text style={{ color: st.fg, fontWeight: '700', fontSize: small ? 11 : 12 }}>{st.text}</Text>
    </View>
  );
};

export const CategoryBadge = ({ category, small }) => {
  const meta = getCategoryMeta(category);
  return (
    <View
      style={{
        backgroundColor: meta.bg,
        paddingHorizontal: small ? 8 : 10,
        paddingVertical: small ? 3 : 5,
        borderRadius: RADIUS.pill,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      {meta.iconSet === 'mci' ? (
        <MaterialCommunityIcons name={meta.icon} size={small ? 12 : 14} color={meta.color} style={{ marginRight: 4 }} />
      ) : (
        <Ionicons name={meta.icon} size={small ? 12 : 14} color={meta.color} style={{ marginRight: 4 }} />
      )}
      <Text style={{ color: meta.color, fontWeight: '700', fontSize: small ? 11 : 12 }}>{meta.short}</Text>
    </View>
  );
};

export const StatCard = ({ title, value, subtitle, icon, iconSet = 'ion', color = C.accent, bg = C.accentSoft, onPress, style }) => (
  <Card onPress={onPress} style={[{ flex: 1, minWidth: 140, padding: SPACE.md }, style]}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View style={[s.statIconWrap, { backgroundColor: bg }]}>
        {iconSet === 'mci' ? (
          <MaterialCommunityIcons name={icon} size={20} color={color} />
        ) : (
          <Ionicons name={icon} size={20} color={color} />
        )}
      </View>
      <Text style={[s.statValue, { color }]}>{value}</Text>
    </View>
    <Text style={s.statTitle}>{title}</Text>
    {subtitle ? <Text style={s.statSub}>{subtitle}</Text> : null}
  </Card>
);

export const Empty = ({ title, text, icon }) => (
  <View style={s.emptyWrap}>
    {icon ? <View style={s.emptyIcon}>{icon}</View> : null}
    <Text style={s.emptyTitle}>{title}</Text>
    {text ? <Text style={s.emptyText}>{text}</Text> : null}
  </View>
);

export const SkeletonList = ({ rows = 3 }) => (
  <View style={{ padding: SPACE.md }}>
    {Array.from({ length: rows }).map((_, i) => (
      <View key={i} style={[s.card, { marginBottom: SPACE.md }]}>
        <View style={s.skelBar} />
        <View style={[s.skelBar, { width: '55%', marginTop: 8, height: 10 }]} />
      </View>
    ))}
  </View>
);

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.sm,
    paddingBottom: SPACE.md,
  },
  h1: { fontSize: isSmall ? 21 : 24, fontWeight: '800', color: C.ink, letterSpacing: -0.4 },
  sub: { color: C.muted, marginTop: 3, fontSize: 13, fontWeight: '500' },
  rolePill: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: C.line,
    padding: SPACE.lg,
    marginBottom: SPACE.md,
    ...SHADOW.card,
  },
  btn: {
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: RADIUS.sm },
  btnText: { fontWeight: '700', fontSize: 14.5 },
  label: { fontWeight: '700', color: C.ink2, marginBottom: 6, fontSize: 13 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.2,
    borderColor: C.line,
    borderRadius: RADIUS.sm,
    padding: 12,
    fontSize: 14.5,
    color: C.ink,
  },
  errorText: { color: C.sos, fontSize: 12, marginTop: 4, fontWeight: '600' },
  hintText: { color: C.muted, fontSize: 12, marginTop: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1.2,
    borderColor: C.line,
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    marginBottom: 8,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 24, fontWeight: '800' },
  statTitle: { fontSize: 13, fontWeight: '700', color: C.ink2, marginTop: 8 },
  statSub: { fontSize: 11, color: C.muted, marginTop: 2 },
  emptyWrap: { alignItems: 'center', padding: SPACE.xxl },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontWeight: '800', color: C.ink, fontSize: 16, textAlign: 'center' },
  emptyText: { color: C.muted, textAlign: 'center', marginTop: 6, fontSize: 13.5, lineHeight: 19 },
  skelBar: { height: 14, borderRadius: 6, backgroundColor: '#E2E8F0', width: '80%' },
});