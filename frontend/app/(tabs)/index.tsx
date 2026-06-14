// Dashboard — first screen after login. Shows:
//   • Stats bar: citywide project counts from /api/stats
//   • All-government reps: local supervisor + mayor, state assembly/senate, federal house/senate
//   • Action Needed: projects with comment deadlines ≤ 7 days away
//   • District projects: top 3 from the user's district
//   • Footer: last nightly data refresh timestamp
// All API calls fire in parallel via Promise.allSettled so a single
// failed endpoint doesn't blank the whole screen.

import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUserStore } from '../../store/userStore';
import { api } from '../../services/api';
import { ProjectCard } from '../../components/ProjectCard';

const DISTRICT_NAMES: Record<number, string> = {
  1: 'Richmond', 2: 'Marina', 3: 'North Beach', 4: 'Sunset', 5: 'Haight',
  6: 'SoMa', 7: 'West Portal', 8: 'Castro', 9: 'Mission', 10: 'Bayview', 11: 'Excelsior',
};

export default function DashboardScreen() {
  const { user, logout } = useUserStore();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [reps, setReps] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!user) return;
    const [p, s, r, lu] = await Promise.allSettled([
      api.getProjects({ district: user.district }),
      api.getStats(),
      api.getReps(user.district),
      api.getLastUpdated(),
    ]);
    if (p.status === 'fulfilled') setProjects(p.value.slice(0, 3));
    if (s.status === 'fulfilled') setStats(s.value);
    if (r.status === 'fulfilled') setReps(r.value);
    if (lu.status === 'fulfilled') setLastUpdated(lu.value.last_updated);
  }

  useEffect(() => { load(); }, [user]);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hi, {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.district}>District {user?.district} · {DISTRICT_NAMES[user?.district || 1]}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={22} color="#a8c4d8" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#fff" />}
      >
        {/* Aggregate stats across all SF projects */}
        {stats && (
          <View style={styles.statsRow}>
            <StatPill label="Projects" value={stats.total_projects} icon="business" />
            <StatPill label="Units" value={stats.total_affordable_units} icon="home" />
            <StatPill label="Hearings" value={stats.active_comment_windows} icon="calendar" />
            <StatPill label="Avg supporters" value={stats.avg_supporters} icon="people" />
          </View>
        )}

        {/* All-government representatives section */}
        {reps && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Representatives</Text>

            <Text style={styles.repGroupLabel}>LOCAL</Text>
            <RepCard name={reps.local.supervisor.name} role={`District ${user?.district} Supervisor · ${reps.local.supervisor.area}`} email={reps.local.supervisor.email} />
            <RepCard name={reps.local.mayor.name} role={reps.local.mayor.title} email={reps.local.mayor.email} />

            <Text style={styles.repGroupLabel}>STATE</Text>
            <RepCard name={reps.state.assembly.name} role={reps.state.assembly.title} email={reps.state.assembly.email} />
            <RepCard name={reps.state.senate.name} role={reps.state.senate.title} email={reps.state.senate.email} />

            <Text style={styles.repGroupLabel}>FEDERAL</Text>
            <RepCard name={reps.federal.house.name} role={reps.federal.house.title} email={reps.federal.house.email} />
            {reps.federal.senate.map((s: any) => (
              <RepCard key={s.name} name={s.name} role={s.title} contactUrl={s.contactUrl} />
            ))}
          </View>
        )}

        {/* Top 3 district projects with a "See all" link to the projects tab */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Projects in District {user?.district}</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/projects')}>
              <Text style={styles.seeAll}>See all →</Text>
            </TouchableOpacity>
          </View>
          {projects.length === 0 ? (
            <Text style={styles.empty}>No projects found in your district yet.</Text>
          ) : (
            projects.map(p => <ProjectCard key={p.id} project={p} />)
          )}
        </View>

        {/* Last-updated footnote — shows when the nightly refresh last ran */}
        <Text style={styles.lastUpdated}>
          {lastUpdated
            ? `Data last updated ${new Date(lastUpdated + 'Z').toLocaleString()}`
            : 'Data refreshes nightly at 2 AM'}
        </Text>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatPill({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon as any} size={16} color="#a8c4d8" />
      <Text style={styles.statValue}>{value?.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RepCard({ name, role, email, contactUrl }: { name: string; role: string; email?: string; contactUrl?: string }) {
  const handleContact = () => {
    if (email) Linking.openURL(`mailto:${email}`);
    else if (contactUrl) Linking.openURL(contactUrl);
  };
  return (
    <View style={styles.repCard}>
      <View style={styles.repIcon}><Text style={styles.repIconText}>🏛️</Text></View>
      <View style={styles.repInfo}>
        <Text style={styles.repName}>{name}</Text>
        <Text style={styles.repRole}>{role}</Text>
        {(email || contactUrl) && (
          <TouchableOpacity onPress={handleContact}>
            <Text style={styles.repContact}>{email || 'Contact form →'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a3c5e' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  greeting: { fontSize: 22, fontWeight: '800', color: '#fff' },
  district: { fontSize: 13, color: '#a8c4d8', marginTop: 2 },
  logoutBtn: { padding: 4 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 4 },
  statPill: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 10, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 16, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 10, color: '#a8c4d8', textAlign: 'center' },
  section: { backgroundColor: '#f8f9fa', marginTop: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111', marginBottom: 12 },
  sectionSub: { fontSize: 12, color: '#666', marginTop: 2 },
  seeAll: { fontSize: 13, color: '#1a3c5e', fontWeight: '600' },
  repGroupLabel: { fontSize: 11, fontWeight: '700', color: '#9ca3af', letterSpacing: 1, marginBottom: 8, marginTop: 4 },
  repCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, padding: 12, gap: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  repIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eef3f9', justifyContent: 'center', alignItems: 'center' },
  repIconText: { fontSize: 18 },
  repInfo: { flex: 1 },
  repName: { fontSize: 14, fontWeight: '700', color: '#111' },
  repRole: { fontSize: 12, color: '#666', marginTop: 1 },
  repContact: { fontSize: 12, color: '#1a3c5e', marginTop: 3 },
  empty: { color: '#9ca3af', textAlign: 'center', paddingVertical: 20 },
  lastUpdated: { fontSize: 11, color: '#a8c4d8', textAlign: 'center', marginTop: 20, paddingHorizontal: 20 },
});
