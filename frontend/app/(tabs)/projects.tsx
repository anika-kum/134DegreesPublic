// Full project browser with two filter rows, text search, and a Legislation tab.
// "Projects" tab: district/type filters hit the API server-side; text search filters locally.
// "Legislation" tab: shows LegiScan-scraped state + federal housing bills with relevant reps.

import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { ProjectCard } from '../../components/ProjectCard';
import { useUserStore } from '../../store/userStore';

const FILTERS = [
  { label: 'All Districts', value: null },
  { label: 'My District', value: 'my' },
];

const TYPE_FILTERS = [
  { label: 'All', value: null },
  { label: '100% Affordable', value: '100% Affordable' },
  { label: 'Senior', value: 'Senior' },
  { label: 'Supportive', value: 'Supportive' },
  { label: 'Family', value: 'Family' },
];

type Tab = 'projects' | 'legislation';

export default function ProjectsScreen() {
  const { user } = useUserStore();
  const [activeTab, setActiveTab] = useState<Tab>('projects');
  const [projects, setProjects] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [districtFilter, setDistrictFilter] = useState<'my' | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  async function loadProjects() {
    setLoading(true);
    try {
      const params: any = {};
      if (districtFilter === 'my' && user) params.district = user.district;
      if (typeFilter) params.type = typeFilter;
      setProjects(await api.getProjects(params));
    } finally {
      setLoading(false);
    }
  }

  async function loadBills() {
    setLoading(true);
    try {
      const result = await api.getBills();
      setBills(result);
    } catch (err: any) {
      console.error('Failed to load bills:', err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'projects') loadProjects();
    else loadBills();
  }, [activeTab, districtFilter, typeFilter]);

  const filteredProjects = projects.filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.address.toLowerCase().includes(search.toLowerCase())
  );
  const filteredBills = bills.filter(b =>
    !search || b.title.toLowerCase().includes(search.toLowerCase()) || b.bill_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>SF Housing</Text>
        <Text style={styles.sub}>
          {activeTab === 'projects'
            ? `${filteredProjects.length} projects in the pipeline`
            : `${filteredBills.length} housing bills tracked`}
        </Text>
      </View>

      {/* Top-level tab switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'projects' && styles.tabBtnActive]} onPress={() => setActiveTab('projects')}>
          <Text style={[styles.tabText, activeTab === 'projects' && styles.tabTextActive]}>Projects</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'legislation' && styles.tabBtnActive]} onPress={() => setActiveTab('legislation')}>
          <Text style={[styles.tabText, activeTab === 'legislation' && styles.tabTextActive]}>Legislation</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={16} color="#9ca3af" style={styles.searchIcon} />
        <TextInput
          style={styles.search}
          placeholder={activeTab === 'projects' ? 'Search by name or address...' : 'Search bills...'}
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#9ca3af"
        />
      </View>

      {activeTab === 'projects' && (
        <>
          <View style={styles.filterRow}>
            {FILTERS.map(f => (
              <TouchableOpacity
                key={String(f.value)}
                style={[styles.filterChip, districtFilter === f.value && styles.filterChipActive]}
                onPress={() => setDistrictFilter(f.value as any)}
              >
                <Text style={[styles.filterText, districtFilter === f.value && styles.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.filterRow}>
            {TYPE_FILTERS.map(f => (
              <TouchableOpacity
                key={String(f.value)}
                style={[styles.filterChip, typeFilter === f.value && styles.filterChipActive]}
                onPress={() => setTypeFilter(f.value)}
              >
                <Text style={[styles.filterText, typeFilter === f.value && styles.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#1a3c5e" />
      ) : activeTab === 'projects' ? (
        <FlatList
          data={filteredProjects}
          keyExtractor={p => String(p.id)}
          renderItem={({ item }) => <ProjectCard project={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.empty}>No projects found.</Text>}
        />
      ) : (
        <FlatList
          data={filteredBills}
          keyExtractor={b => String(b.id)}
          renderItem={({ item }) => <BillCard bill={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadBills} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {bills.length === 0
                ? 'No bills yet — add CONGRESS_API_KEY and OPENSTATES_API_KEY to .env and wait for the nightly refresh.'
                : 'No bills match your search.'}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

function BillCard({ bill }: { bill: any }) {
  const router = useRouter();
  const levelColor = bill.government_level === 'federal' ? '#7c3aed' : '#0369a1';
  const reps: any[] = bill.relevant_reps || [];

  return (
    <TouchableOpacity style={styles.billCard} onPress={() => router.push(`/bill/${bill.id}` as any)}>
      <View style={styles.billHeader}>
        <View style={[styles.levelBadge, { backgroundColor: levelColor + '20' }]}>
          <Text style={[styles.levelText, { color: levelColor }]}>
            {bill.government_level === 'federal' ? 'Federal' : 'State · CA'}
          </Text>
        </View>
        <Text style={styles.billNumber}>{bill.bill_number}</Text>
      </View>
      <Text style={styles.billTitle} numberOfLines={3}>{bill.title}</Text>
      {bill.description ? <Text style={styles.billDesc} numberOfLines={2}>{bill.description}</Text> : null}
      {reps.length > 0 && (
        <View style={styles.billReps}>
          <Text style={styles.billRepsLabel}>Contact: </Text>
          <Text style={styles.billRepsNames}>{reps.map((r: any) => r.name).join(', ')}</Text>
        </View>
      )}
      <Text style={styles.billLinkText}>View details + take action →</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: '#111' },
  sub: { fontSize: 13, color: '#666', marginTop: 2 },
  tabRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 6, backgroundColor: '#e5e7eb', borderRadius: 10, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  tabBtnActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#1a3c5e' },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 8, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  search: { flex: 1, paddingVertical: 10, fontSize: 14, color: '#111' },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  filterChip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  filterChipActive: { backgroundColor: '#1a3c5e', borderColor: '#1a3c5e' },
  filterText: { fontSize: 13, color: '#666', fontWeight: '500' },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40, paddingHorizontal: 20 },
  billCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  billHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  levelBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  levelText: { fontSize: 11, fontWeight: '700' },
  billNumber: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  billTitle: { fontSize: 14, fontWeight: '700', color: '#111', lineHeight: 20, marginBottom: 6 },
  billDesc: { fontSize: 13, color: '#555', lineHeight: 18, marginBottom: 8 },
  billReps: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  billRepsLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  billRepsNames: { fontSize: 12, color: '#1a3c5e', flex: 1 },
  billLink: { alignSelf: 'flex-start' },
  billLinkText: { fontSize: 12, color: '#1a3c5e', fontWeight: '600' },
});
