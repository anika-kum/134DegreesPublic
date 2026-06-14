// Project detail screen — the primary action surface of the app.
// Shows full project metadata, hearing date, all relevant representatives
// (from project.relevant_reps, enriched nightly), and the AI advocacy panel.
//
// When generating an email, the user first picks which representative to address.
// The selected rep is sent to the backend so Claude tailors the ask to that
// official's specific jurisdiction and powers.

import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';

const TONES = [
  { key: 'emotional', label: 'Personal & Urgent', desc: 'Lead with your lived experience and human impact' },
  { key: 'data-driven', label: 'Data & Policy', desc: 'Statistics, AMI levels, planning policy arguments' },
  { key: 'formal', label: 'Formal Letter', desc: 'Professional tone appropriate for an official' },
];

const LEVEL_COLORS: Record<string, string> = {
  local: '#0369a1',
  state: '#166534',
  federal: '#7c3aed',
};

type Channel = 'email' | 'tweet' | 'call';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [coalitionCount, setCoalitionCount] = useState(0);

  // Advocacy panel state
  const [activeChannel, setActiveChannel] = useState<Channel>('email');
  const [tone, setTone] = useState('emotional');
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<Record<Channel, string>>({ email: '', tweet: '', call: '' });
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  // Rep picker — null means "use project default (district supervisor)"
  const [selectedRep, setSelectedRep] = useState<any | null>(null);

  useEffect(() => {
    api.getProject(Number(id)).then(p => {
      setProject(p);
      setCoalitionCount(p.coalition_count);
      // Default to the first relevant_rep (district supervisor) if available
      if (p.relevant_reps?.length) setSelectedRep(p.relevant_reps[0]);
      setLoading(false);
    }).catch(() => { Alert.alert('Error', 'Could not load project'); router.back(); });

    api.getSubscriptions().then(subs => {
      setSubscribed(subs.some((s: any) => String(s.id) === id));
    }).catch(() => {});
  }, [id]);

  async function generate() {
    if (!project) return;
    setGenerating(true);
    try {
      const { content } = await api.generateContent({
        project_id: project.id,
        channel: activeChannel,
        tone: activeChannel === 'email' ? tone : undefined,
        // Pass the selected rep so Claude addresses the right official
        target_rep: activeChannel === 'email' ? selectedRep : undefined,
      });
      setGeneratedContent(prev => ({ ...prev, [activeChannel]: content }));
    } catch (err: any) {
      Alert.alert('Generation failed', err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function markSent() {
    const content = generatedContent[activeChannel];
    if (!content) return;
    try {
      const result = await api.advocate(project.id, {
        channel: activeChannel,
        content,
        tone: activeChannel === 'email' ? tone : undefined,
      });
      setCoalitionCount(result.coalition_count);
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch {}
  }

  async function copyContent() {
    const content = generatedContent[activeChannel];
    if (!content) return;
    await Clipboard.setStringAsync(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    markSent();
  }

  async function openEmail() {
    if (!project || !generatedContent.email) return;
    const lines = generatedContent.email.split('\n');
    const subjectLine = lines.find(l => l.startsWith('Subject:'));
    const subject = subjectLine ? subjectLine.replace('Subject:', '').trim() : `Support for ${project.title}`;
    const body = generatedContent.email.replace(subjectLine || '', '').trim();
    // Use selected rep's email if available; fall back to district supervisor
    const recipient = selectedRep?.email || project.supervisor_email;
    const url = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    await Linking.openURL(url);
    markSent();
  }

  async function toggleSubscribe() {
    if (subscribed) {
      await api.unsubscribe(project.id);
      setSubscribed(false);
    } else {
      await api.subscribe(project.id);
      setSubscribed(true);
      Alert.alert('Subscribed!', "You'll be notified when this project opens applications.");
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color="#1a3c5e" size="large" />
      </SafeAreaView>
    );
  }

  const currentContent = generatedContent[activeChannel];
  const relevantReps: any[] = project.relevant_reps || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={toggleSubscribe} style={styles.subscribeBtn}>
          <Ionicons name={subscribed ? 'notifications' : 'notifications-outline'} size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroMeta}>
            <View style={styles.typeBadge}><Text style={styles.typeText}>{project.type}</Text></View>
            <Text style={styles.district}>District {project.district}</Text>
          </View>
          <Text style={styles.heroTitle}>{project.title}</Text>
          <View style={styles.heroAddress}>
            <Ionicons name="location" size={14} color="#a8c4d8" />
            <Text style={styles.heroAddressText}>{project.address}</Text>
          </View>
          <View style={styles.coalition}>
            <Ionicons name="people" size={16} color="#f59e0b" />
            <Text style={styles.coalitionText}>{coalitionCount} advocates supporting this project</Text>
            {sent && <Text style={styles.coalitionDelta}> +1 (you!)</Text>}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.grid}>
            <Detail icon="home" label="Total units" value={String(project.units_total)} />
            <Detail icon="heart" label="Affordable" value={String(project.units_affordable)} />
            <Detail icon="stats-chart" label="AMI levels" value={Array.isArray(project.ami_levels) ? project.ami_levels.join(', ') : project.ami_levels} />
            <Detail icon="document-text" label="Case #" value={project.case_number} />
            <Detail icon="calendar" label="Hearing" value={project.hearing_date} />
            <Detail icon="business" label="Lead agency" value={project.lead_agency} />
          </View>
          <Text style={styles.description}>{project.description}</Text>
        </View>

        {/* Representatives — grouped by level, sourced from relevant_reps enrichment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Representatives</Text>
          {relevantReps.length === 0 ? (
            // Fallback if enrichment hasn't run yet
            <>
              <RepRow icon="🏛️" label="District Supervisor" name={project.supervisor} email={project.supervisor_email} />
              <RepRow icon="🏟️" label="State Assembly" name={project.state_assembly} />
              <RepRow icon="🏛" label="State Senate" name={project.state_senate} />
            </>
          ) : (
            relevantReps.map((rep: any) => (
              <RepRow key={rep.name} icon={rep.level === 'federal' ? '🇺🇸' : rep.level === 'state' ? '🏛' : '🏙️'}
                label={rep.title} name={rep.name} email={rep.email} contactUrl={rep.contactUrl}
                levelColor={LEVEL_COLORS[rep.level] || '#666'} reason={rep.reason} />
            ))
          )}
        </View>

        {/* AI Advocacy Panel */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Take Action</Text>
          <Text style={styles.sectionSub}>Generate AI-drafted advocacy content personalized to your background.</Text>

          <View style={styles.channelRow}>
            {(['email', 'tweet', 'call'] as Channel[]).map(ch => (
              <TouchableOpacity
                key={ch}
                style={[styles.channelBtn, activeChannel === ch && styles.channelBtnActive]}
                onPress={() => setActiveChannel(ch)}
              >
                <Ionicons
                  name={ch === 'email' ? 'mail' : ch === 'tweet' ? 'logo-twitter' : 'call'}
                  size={16}
                  color={activeChannel === ch ? '#fff' : '#666'}
                />
                <Text style={[styles.channelText, activeChannel === ch && styles.channelTextActive]}>
                  {ch === 'email' ? 'Email' : ch === 'tweet' ? 'Tweet' : 'Call Script'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Rep picker — shown for email only; determines who Claude addresses */}
          {activeChannel === 'email' && relevantReps.length > 0 && (
            <View style={styles.repPicker}>
              <Text style={styles.repPickerLabel}>Address email to:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.repPickerScroll}>
                {relevantReps.map((rep: any) => (
                  <TouchableOpacity
                    key={rep.name}
                    style={[styles.repChip, selectedRep?.name === rep.name && styles.repChipActive]}
                    onPress={() => { setSelectedRep(rep); setGeneratedContent(prev => ({ ...prev, email: '' })); }}
                  >
                    <View style={[styles.repChipDot, { backgroundColor: LEVEL_COLORS[rep.level] || '#666' }]} />
                    <Text style={[styles.repChipText, selectedRep?.name === rep.name && styles.repChipTextActive]}>
                      {rep.name.split(' ').pop()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {selectedRep && (
                <Text style={styles.repPickerHint}>{selectedRep.title} · {selectedRep.reason}</Text>
              )}
            </View>
          )}

          {activeChannel === 'email' && (
            <View style={styles.toneSection}>
              <Text style={styles.toneLabel}>Tone</Text>
              <View style={styles.toneRow}>
                {TONES.map(t => (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.toneBtn, tone === t.key && styles.toneBtnActive]}
                    onPress={() => setTone(t.key)}
                  >
                    <Text style={[styles.toneBtnText, tone === t.key && styles.toneBtnTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.toneDesc}>{TONES.find(t => t.key === tone)?.desc}</Text>
            </View>
          )}

          {!currentContent && (
            <TouchableOpacity style={styles.generateBtn} onPress={generate} disabled={generating}>
              {generating ? (
                <ActivityIndicator color="#1a3c5e" />
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color="#1a3c5e" />
                  <Text style={styles.generateBtnText}>
                    Generate {activeChannel === 'email' ? `Email to ${selectedRep?.name?.split(' ').pop() || 'Supervisor'}` : activeChannel === 'tweet' ? 'Tweet' : 'Call Script'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {currentContent && (
            <View style={styles.contentBox}>
              <View style={styles.contentBoxHeader}>
                <Text style={styles.contentBoxLabel}>
                  {activeChannel === 'email'
                    ? `Email to ${selectedRep?.name || project.supervisor}`
                    : activeChannel === 'tweet' ? 'Your tweet' : 'Your call script'}
                </Text>
                <TouchableOpacity onPress={generate} style={styles.regenBtn}>
                  <Ionicons name="refresh" size={14} color="#666" />
                  <Text style={styles.regenText}>Regenerate</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.contentText}>{currentContent}</Text>

              <View style={styles.actionRow}>
                {activeChannel === 'email' && (
                  <TouchableOpacity style={styles.actionPrimary} onPress={openEmail}>
                    <Ionicons name="send" size={16} color="#fff" />
                    <Text style={styles.actionPrimaryText}>Open in Email App</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.actionSecondary} onPress={copyContent}>
                  <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color="#1a3c5e" />
                  <Text style={styles.actionSecondaryText}>{copied ? 'Copied!' : 'Copy'}</Text>
                </TouchableOpacity>
                {activeChannel === 'tweet' && (
                  <TouchableOpacity
                    style={styles.actionPrimary}
                    onPress={() => { Linking.openURL(`https://twitter.com/intent/tweet?text=${encodeURIComponent(currentContent)}`); markSent(); }}
                  >
                    <Ionicons name="logo-twitter" size={16} color="#fff" />
                    <Text style={styles.actionPrimaryText}>Post Tweet</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>

        {project.portal_url && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.portalBtn} onPress={() => Linking.openURL(project.portal_url)}>
              <Ionicons name="open-outline" size={16} color="#1a3c5e" />
              <Text style={styles.portalText}>View on SF Planning Portal</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Detail({ label, value }: { icon: string; label: string; value?: string }) {
  if (!value || value === 'null') return null;
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function RepRow({ icon, label, name, email, contactUrl, levelColor, reason }: {
  icon: string; label: string; name?: string; email?: string; contactUrl?: string; levelColor?: string; reason?: string;
}) {
  if (!name) return null;
  const handleContact = () => {
    if (email) Linking.openURL(`mailto:${email}`);
    else if (contactUrl) Linking.openURL(contactUrl);
  };
  return (
    <View style={styles.repRow}>
      <Text style={styles.repIcon}>{icon}</Text>
      <View style={styles.repInfo}>
        <Text style={styles.repLabel}>{label}</Text>
        <Text style={styles.repName}>{name}</Text>
        {reason && <Text style={styles.repReason}>{reason}</Text>}
        {(email || contactUrl) && (
          <TouchableOpacity onPress={handleContact}>
            <Text style={[styles.repEmail, levelColor ? { color: levelColor } : {}]}>
              {email || 'Contact form →'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const C = { navy: '#1a3c5e', amber: '#f59e0b', bg: '#f8f9fa', text: '#111', sub: '#666' };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.navy, paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 4 },
  subscribeBtn: { padding: 4 },
  hero: { backgroundColor: C.navy, paddingHorizontal: 20, paddingBottom: 24 },
  heroMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  typeBadge: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  typeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  district: { fontSize: 12, color: '#a8c4d8' },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#fff', lineHeight: 26, marginBottom: 8 },
  heroAddress: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  heroAddressText: { fontSize: 13, color: '#a8c4d8', flex: 1 },
  coalition: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245,158,11,0.15)', borderRadius: 10, padding: 10 },
  coalitionText: { fontSize: 13, color: C.amber, fontWeight: '600' },
  coalitionDelta: { fontSize: 13, color: '#6ee7b7', fontWeight: '700' },
  section: { backgroundColor: '#fff', marginTop: 8, padding: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 4 },
  sectionSub: { fontSize: 13, color: C.sub, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  detailItem: { width: '45%' },
  detailLabel: { fontSize: 11, color: C.sub, marginBottom: 2 },
  detailValue: { fontSize: 13, fontWeight: '600', color: C.text },
  description: { fontSize: 14, color: '#444', lineHeight: 22 },
  repRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  repIcon: { fontSize: 20, marginTop: 2 },
  repInfo: { flex: 1 },
  repLabel: { fontSize: 11, color: C.sub },
  repName: { fontSize: 14, fontWeight: '600', color: C.text },
  repReason: { fontSize: 11, color: '#888', marginTop: 1, fontStyle: 'italic' },
  repEmail: { fontSize: 12, color: C.navy, marginTop: 3 },
  channelRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  channelBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingVertical: 10, backgroundColor: '#fff' },
  channelBtnActive: { backgroundColor: C.navy, borderColor: C.navy },
  channelText: { fontSize: 13, fontWeight: '600', color: C.sub },
  channelTextActive: { color: '#fff' },
  repPicker: { marginBottom: 14 },
  repPickerLabel: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 8 },
  repPickerScroll: { marginBottom: 6 },
  repChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8, backgroundColor: '#fff' },
  repChipActive: { backgroundColor: C.navy, borderColor: C.navy },
  repChipDot: { width: 7, height: 7, borderRadius: 4 },
  repChipText: { fontSize: 13, fontWeight: '600', color: C.sub },
  repChipTextActive: { color: '#fff' },
  repPickerHint: { fontSize: 11, color: '#888', fontStyle: 'italic', marginTop: 4 },
  toneSection: { marginBottom: 16 },
  toneLabel: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 8 },
  toneRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 6 },
  toneBtn: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  toneBtnActive: { backgroundColor: C.navy, borderColor: C.navy },
  toneBtnText: { fontSize: 12, color: C.sub, fontWeight: '500' },
  toneBtnTextActive: { color: '#fff', fontWeight: '600' },
  toneDesc: { fontSize: 12, color: C.sub, fontStyle: 'italic' },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.amber, borderRadius: 12, paddingVertical: 16 },
  generateBtnText: { fontSize: 16, fontWeight: '700', color: C.navy },
  contentBox: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden' },
  contentBoxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  contentBoxLabel: { fontSize: 13, fontWeight: '600', color: C.text },
  regenBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  regenText: { fontSize: 12, color: C.sub },
  contentText: { fontSize: 13, color: '#333', lineHeight: 20, padding: 14 },
  actionRow: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb', flexWrap: 'wrap' },
  actionPrimary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.navy, borderRadius: 10, paddingVertical: 10 },
  actionPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  actionSecondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: C.navy, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16 },
  actionSecondaryText: { color: C.navy, fontWeight: '600', fontSize: 13 },
  portalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingVertical: 12 },
  portalText: { fontSize: 14, color: C.navy, fontWeight: '600' },
});
