// Resources tab: live SF shelter beds, rent relief funds, Section 8, and
// housing portal links. Resources are grouped by type and displayed with
// an availability badge (green = open beds, red = full).
// Phone numbers open the native dialer; URLs open the system browser.

import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';

// Display metadata for each resource type — label, emoji, and accent color
const TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  emergency_shelter: { label: 'Emergency Shelter', icon: '🏠', color: '#dc2626' },
  rent_relief: { label: 'Rent Relief', icon: '💰', color: '#059669' },
  section8: { label: 'Section 8', icon: '📋', color: '#7c3aed' },
  affordable_housing_list: { label: 'Housing Portal', icon: '🔑', color: '#1a3c5e' },
};

const TYPE_FILTERS = [
  { label: 'All', value: null },
  { label: 'Shelter', value: 'emergency_shelter' },
  { label: 'Rent Relief', value: 'rent_relief' },
  { label: 'Section 8', value: 'section8' },
  { label: 'Housing Lists', value: 'affordable_housing_list' },
];

export default function ResourcesScreen() {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api.getResources(typeFilter ? { type: typeFilter } : undefined);
      setResources(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => { setLoading(true); load(); }, [typeFilter]);

  // Group resources by type for section headers
  const grouped = resources.reduce((acc, r) => {
    const type = r.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(r);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Immediate Resources</Text>
        <Text style={styles.sub}>Live SF shelter beds, rent relief & housing lists</Text>
      </View>

      <View style={styles.filterRow}>
        {TYPE_FILTERS.map(f => (
          <TouchableOpacity
            key={String(f.value)}
            style={[styles.chip, typeFilter === f.value && styles.chipActive]}
            onPress={() => setTypeFilter(f.value)}
          >
            <Text style={[styles.chipText, typeFilter === f.value && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#1a3c5e" />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
        >
          {Object.entries(grouped).map(([type, items]) => {
            const meta = TYPE_META[type] || { label: type, icon: '📌', color: '#666' };
            return (
              <View key={type} style={styles.section}>
                <Text style={styles.sectionTitle}>{meta.icon} {meta.label}</Text>
                {(items as any[]).map(r => <ResourceCard key={r.id} resource={r} meta={meta} />)}
              </View>
            );
          })}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// Individual resource card: name, address, notes, and tap-to-call / open URL actions
function ResourceCard({ resource: r }: { resource: any; meta: any }) {
  const hasAvail = r.available_beds != null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardName}>{r.name}</Text>
        {/* Availability badge only shown for shelters that track bed counts */}
        {hasAvail && (
          <View style={[styles.availBadge, r.available_beds > 0 ? styles.availOpen : styles.availFull]}>
            <Text style={styles.availText}>{r.available_beds > 0 ? `${r.available_beds} open` : 'Full'}</Text>
          </View>
        )}
      </View>

      {r.address && (
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={13} color="#666" />
          <Text style={styles.infoText}>{r.address}</Text>
        </View>
      )}

      {r.notes && <Text style={styles.notes}>{r.notes}</Text>}

      <View style={styles.actions}>
        {r.phone && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(`tel:${r.phone}`)}>
            <Ionicons name="call-outline" size={15} color="#1a3c5e" />
            <Text style={styles.actionText}>{r.phone}</Text>
          </TouchableOpacity>
        )}
        {r.url && (
          <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(r.url)}>
            <Ionicons name="open-outline" size={15} color="#1a3c5e" />
            <Text style={styles.actionText}>Website</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: '#111' },
  sub: { fontSize: 13, color: '#666', marginTop: 2 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  chip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  chipActive: { backgroundColor: '#1a3c5e', borderColor: '#1a3c5e' },
  chipText: { fontSize: 13, color: '#666', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  scroll: { paddingHorizontal: 16 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardName: { fontSize: 14, fontWeight: '700', color: '#111', flex: 1, marginRight: 8 },
  availBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  availOpen: { backgroundColor: '#d1fae5' },
  availFull: { backgroundColor: '#fee2e2' },
  availText: { fontSize: 11, fontWeight: '700', color: '#111' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  infoText: { fontSize: 12, color: '#666', flex: 1 },
  notes: { fontSize: 12, color: '#444', lineHeight: 18, marginVertical: 6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#eef3f9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  actionText: { fontSize: 12, color: '#1a3c5e', fontWeight: '600' },
});
