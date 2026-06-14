// My Alerts tab: shows all projects the user has subscribed to.
// Displays an SMS status banner if SMS alerts are not yet configured.
// Unsubscribing removes the row optimistically without a full re-fetch.
// Tapping a card navigates to the full project detail.

import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { useUserStore } from '../../store/userStore';

export default function AlertsScreen() {
  const { user } = useUserStore();
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const data = await api.getSubscriptions();
      setSubscriptions(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Optimistic removal — filter locally instead of re-fetching the full list
  async function unsubscribe(id: number) {
    await api.unsubscribe(id);
    setSubscriptions(s => s.filter(p => p.id !== id));
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Project Alerts</Text>
        <Text style={styles.sub}>
          {user?.sms_alerts
            ? `SMS alerts active → ${user.phone}`
            : 'Enable SMS in your profile to get text alerts'}
        </Text>
      </View>

      {/* Prompt users to add a phone number if SMS is not yet configured */}
      {!user?.sms_alerts && (
        <TouchableOpacity style={styles.smsBanner} onPress={() => router.push('/(tabs)/profile' as any)}>
          <Ionicons name="notifications-outline" size={20} color="#d97706" />
          <Text style={styles.smsBannerText}>Add your phone number and enable SMS alerts to get notified the moment a subscribed project opens applications. Tap to set up →</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#1a3c5e" />
      ) : (
        <FlatList
          data={subscriptions}
          keyExtractor={p => String(p.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>No subscriptions yet</Text>
              <Text style={styles.emptySub}>Browse projects and tap "Subscribe" to get alerts when they open for applications.</Text>
              <TouchableOpacity style={styles.browseBtn} onPress={() => router.push('/(tabs)/projects')}>
                <Text style={styles.browseBtnText}>Browse Projects</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item: p }) => (
            <View style={styles.card}>
              {/* Card body is tappable; unsubscribe is a separate row below */}
              <TouchableOpacity style={styles.cardBody} onPress={() => router.push(`/project/${p.id}` as any)}>
                <View style={styles.cardHeader}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeText}>{p.type}</Text>
                  </View>
                  <Text style={styles.status}>{p.status}</Text>
                </View>
                <Text style={styles.cardTitle} numberOfLines={2}>{p.title}</Text>
                <Text style={styles.cardAddress}>{p.address}</Text>
                <View style={styles.cardMeta}>
                  <Ionicons name="home-outline" size={13} color="#666" />
                  <Text style={styles.cardMetaText}>{p.units_affordable} affordable units</Text>
                </View>
                {p.hearing_date && (
                  <Text style={styles.waitText}>Hearing: {p.hearing_date}</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.unsubBtn} onPress={() => unsubscribe(p.id)}>
                <Ionicons name="notifications-off-outline" size={15} color="#dc2626" />
                <Text style={styles.unsubText}>Unsubscribe</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: '#111' },
  sub: { fontSize: 13, color: '#666', marginTop: 2 },
  smsBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: 16, marginBottom: 8, padding: 12, backgroundColor: '#fffbeb', borderRadius: 10, borderWidth: 1, borderColor: '#d97706' },
  smsBannerText: { flex: 1, fontSize: 13, color: '#92400e', lineHeight: 18 },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#111', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 20 },
  browseBtn: { marginTop: 20, backgroundColor: '#1a3c5e', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  browseBtnText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardBody: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  typeBadge: { backgroundColor: '#eef3f9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeText: { fontSize: 11, fontWeight: '600', color: '#1a3c5e' },
  status: { fontSize: 11, color: '#666' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 3 },
  cardAddress: { fontSize: 12, color: '#666', marginBottom: 8 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  cardMetaText: { fontSize: 12, color: '#666' },
  waitText: { fontSize: 12, color: '#9ca3af', fontStyle: 'italic' },
  unsubBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  unsubText: { fontSize: 13, color: '#dc2626', fontWeight: '600' },
});
