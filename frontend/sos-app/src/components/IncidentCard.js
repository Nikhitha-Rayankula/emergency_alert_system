import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, StatusBadge, CategoryBadge, C, SPACE, RADIUS, fmt, Btn, IdBadge, fmtSosId, fmtSocId, fmtFltId } from '../ui';

export default function IncidentCard({
  incident,
  onPress,
  onAccept,
  acceptLoading = false,
  showAcceptBtn = false,
  distance,
}) {
  const isPending = ['open', 'escalated'].includes(incident.status);

  return (
    <Card
      onPress={onPress}
      borderTone={incident.status === 'open' ? C.sos : incident.status === 'escalated' ? C.warn : null}
      style={styles.card}
    >
      <View style={styles.topRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <CategoryBadge category={incident.category} small />
          <IdBadge id={incident.id} prefix="SOS" size="sm" />
        </View>
        <StatusBadge status={incident.status} small />
      </View>

      <View style={styles.middleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.userText}>
            {incident.user ? `Alert by ${incident.user}` : 'Emergency Incident'}
          </Text>
          {incident.message ? (
            <Text style={styles.msgText} numberOfLines={2}>
              "{incident.message}"
            </Text>
          ) : (
            <Text style={styles.subText}>Location broadcast active</Text>
          )}

          {/* Society & Flat info if available */}
          {(incident.society_name || incident.flat_number) && (
            <Text style={styles.locSubText}>
              📍 {incident.society_name || `Society #${incident.society_id || ''}`}
              {incident.flat_number ? ` • Flat ${incident.flat_number}` : ''}
            </Text>
          )}
        </View>

        {distance && (
          <View style={styles.distanceBadge}>
            <Ionicons name="navigate" size={12} color={C.accentInk} style={{ marginRight: 3 }} />
            <Text style={styles.distanceText}>{distance}</Text>
          </View>
        )}
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.timeWrap}>
          <Ionicons name="time-outline" size={13} color={C.muted} style={{ marginRight: 4 }} />
          <Text style={styles.timeText}>{fmt(incident.created_at)}</Text>
        </View>

        {incident.responder && (
          <View style={styles.respWrap}>
            <Ionicons name="shield-checkmark" size={13} color={C.safeDark} style={{ marginRight: 4 }} />
            <Text style={styles.respText}>{incident.responder}</Text>
          </View>
        )}
      </View>

      {showAcceptBtn && isPending && onAccept && (
        <View style={styles.actionWrap}>
          <Btn
            title="Accept & Navigate"
            kind="safe"
            size="sm"
            loading={acceptLoading}
            onPress={onAccept}
            icon={<Ionicons name="navigate-circle" size={16} color="#fff" />}
            style={{ flex: 1 }}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: SPACE.md,
    marginBottom: SPACE.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACE.sm,
  },
  middleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACE.sm,
  },
  userText: {
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
  },
  msgText: {
    fontSize: 13,
    color: C.ink3,
    marginTop: 3,
    fontStyle: 'italic',
  },
  subText: {
    fontSize: 12,
    color: C.muted,
    marginTop: 2,
  },
  locSubText: {
    fontSize: 11.5,
    color: C.accentInk,
    fontWeight: '600',
    marginTop: 3,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.accentSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    marginLeft: 8,
  },
  distanceText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: C.accentInk,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.lineLight,
  },
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 11.5,
    color: C.muted,
    fontWeight: '500',
  },
  respWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.safeSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
  },
  respText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: C.safeInk,
  },
  actionWrap: {
    marginTop: SPACE.sm,
    paddingTop: SPACE.sm,
    borderTopWidth: 1,
    borderTopColor: C.lineLight,
  },
});
