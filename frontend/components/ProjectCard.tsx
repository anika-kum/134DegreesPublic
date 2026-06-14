// Tappable card for a housing project. Navigates to /project/[id] on press.
// Used in the dashboard (urgent projects section) and the full projects list.

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

interface Project {
  id: number;
  title: string;
  address: string;
  district: number;
  type: string;
  status: string;
  units_affordable: number;
  supervisor: string;
  hearing_date: string | null;
  coalition_count: number;
}

export function ProjectCard({ project }: { project: Project }) {
  const router = useRouter();

  return (
    // `as any` required because expo-router's type generation doesn't cover dynamic paths at build time
    <TouchableOpacity style={styles.card} onPress={() => router.push(`/project/${project.id}` as any)}>
      <View style={styles.header}>
        <View style={styles.typeBadge}>
          <Text style={styles.typeText}>{project.type}</Text>
        </View>
        {/* District badge (D1–D11) gives users quick geographic context */}
        <Text style={styles.district}>D{project.district}</Text>
      </View>

      <Text style={styles.title} numberOfLines={2}>{project.title}</Text>
      <Text style={styles.address} numberOfLines={1}>{project.address}</Text>

      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Ionicons name="home-outline" size={13} color="#666" />
          <Text style={styles.metaText}>{project.units_affordable} affordable units</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="person-outline" size={13} color="#666" />
          <Text style={styles.metaText}>{project.supervisor}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        {project.hearing_date && (
          <View style={styles.hearingBadge}>
            <Ionicons name="calendar-outline" size={11} color="#1a3c5e" />
            <Text style={styles.hearingText}>Hearing {project.hearing_date}</Text>
          </View>
        )}
        <View style={styles.coalition}>
          <Ionicons name="people" size={13} color="#1a3c5e" />
          <Text style={styles.coalitionText}>{project.coalition_count} advocating</Text>
        </View>
      </View>

      {/* Amber dot signals the project is in an active planning stage */}
      <View style={styles.statusRow}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>{project.status}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  typeBadge: { backgroundColor: '#eef3f9', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeText: { fontSize: 11, fontWeight: '600', color: '#1a3c5e' },
  district: { fontSize: 12, fontWeight: '700', color: '#9ca3af' },
  title: { fontSize: 16, fontWeight: '700', color: '#111', marginBottom: 4, lineHeight: 22 },
  address: { fontSize: 13, color: '#666', marginBottom: 10 },
  meta: { gap: 4, marginBottom: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: '#666' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  coalition: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  coalitionText: { fontSize: 12, color: '#1a3c5e', fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },
  statusText: { fontSize: 12, color: '#666' },
  hearingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hearingText: { fontSize: 11, color: '#1a3c5e', fontWeight: '600' },
});
