// Bill detail screen — mirrors the project detail screen but for state/federal legislation.
// Shows bill metadata, relevant representatives, and the same AI advocacy panel
// (email / tweet / call script) with a rep picker so the ask is tailored to whoever
// the user chooses to contact.

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
  { key: 'data-driven', label: 'Data & Policy', desc: 'Policy context, housing statistics, bill provisions' },
  { key: 'formal', label: 'Formal Letter', desc: 'Professional tone appropriate for an official' },
];

const LEVEL_COLORS: Record<string, string> = {
  local: '#0369a1',
  state: '#166534',
  federal: '#7c3aed',
};

type Channel = 'email' | 'tweet' | 'call';

export default function BillDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [bill, setBill] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [activeChannel, setActiveChannel] = useState<Channel>('email');
  const [tone, setTone] = useState('emotional');
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<Record<Channel, string>>({ email: '', tweet: '', call: '' });
  const [copied, setCopied] = useState(false);
  const [selectedRep, setSelectedRep] = useState<any | null>(null);

  useEffect(() => {
    api.getBill(Number(id)).then(b => {
      setBill(b);
      if (b.relevant_reps?.length) setSelectedRep(b.relevant_reps[0]);
      setLoading(false);
    }).catch(() => { Alert.alert('Error', 'Could not load bill'); router.back(); });
  }, [id]);

  async function generate() {
    if (!bill) return;
    setGenerating(true);
    try {
      const { content } = await api.generateContent({
        bill_id: bill.id,
        channel: activeChannel,
        tone: activeChannel === 'email' ? tone : undefined,
        target_rep: activeChannel === 'email' ? selectedRep : undefined,
      });
      setGeneratedContent(prev => ({ ...prev, [activeChannel]: content }));
    } catch (err: any) {
      Alert.alert('Generation failed', err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function copyContent() {
    const content = generatedContent[activeChannel];
    if (!content) return;
    await Clipboard.setStringAsync(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function openEmail() {
    if (!bill || !generatedContent.email) return;

    // Federal senators use a web contact form instead of a direct email address
    if (!selectedRep?.email && selectedRep?.contactUrl) {
      await Clipboard.setStringAsync(generatedContent.email);
      Alert.alert(
        'Open Contact Form',
        `${selectedRep.name} uses a web contact form instead of a direct email. The email has been copied to your clipboard — paste it into their form.`,
        [
          { text: 'Open Form', onPress: () => Linking.openURL(selectedRep.contactUrl) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    const lines = generatedContent.email.split('\n');
    const subjectLine = lines.find(l => l.startsWith('Subject:'));
    const subject = subjectLine ? subjectLine.replace('Subject:', '').trim() : `Support for ${bill.bill_number}`;
    const body = generatedContent.email.replace(subjectLine || '', '').trim();
    const recipient = selectedRep?.email || '';
    const url = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    await Linking.openURL(url);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color="#1a3c5e" size="large" />
      </SafeAreaView>
    );
  }

  const relevantReps: any[] = bill.relevant_reps || [];
  const currentContent = generatedContent[activeChannel];
  const levelColor = bill.government_level === 'federal' ? '#7c3aed' : '#166534';
  const levelLabel = bill.government_level === 'federal' ? 'Federal' : 'State · CA';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroMeta}>
            <View style={[styles.levelBadge, { backgroundColor: levelColor + '30' }]}>
              <Text style={[styles.levelText, { color: '#fff' }]}>{levelLabel}</Text>
            </View>
            <Text style={styles.billNumber}>{bill.bill_number}</Text>
          </View>
          <Text style={styles.heroTitle}>{bill.title}</Text>
          {bill.status ? (
            <View style={styles.statusRow}>
              <Ionicons name="time-outline" size={14} color="#a8c4d8" />
              <Text style={styles.statusText} numberOfLines={2}>{bill.status}</Text>
            </View>
          ) : null}
        </View>

        {/* Description */}
        {bill.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.description}>{bill.description}</Text>
          </View>
        ) : null}

        {/* Relevant representatives */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Relevant Representatives</Text>
          {relevantReps.length === 0 ? (
            <Text style={styles.emptyReps}>Representatives will appear after the next nightly enrichment.</Text>
          ) : (
            relevantReps.map((rep: any) => (
              <View key={rep.name} style={styles.repRow}>
                <Text style={styles.repIcon}>
                  {rep.level === 'federal' ? '🇺🇸' : rep.level === 'state' ? '🏛' : '🏙️'}
                </Text>
                <View style={styles.repInfo}>
                  <Text style={styles.repLabel}>{rep.title}</Text>
                  <Text style={styles.repName}>{rep.name}</Text>
                  {rep.reason ? <Text style={styles.repReason}>{rep.reason}</Text> : null}
                  {rep.email ? (
                    <TouchableOpacity onPress={() => Linking.openURL(`mailto:${rep.email}`)}>
                      <Text style={[styles.repContact, { color: LEVEL_COLORS[rep.level] || '#1a3c5e' }]}>{rep.email}</Text>
                    </TouchableOpacity>
                  ) : rep.contactUrl ? (
                    <TouchableOpacity onPress={() => Linking.openURL(rep.contactUrl)}>
                      <Text style={[styles.repContact, { color: LEVEL_COLORS[rep.level] || '#1a3c5e' }]}>Contact form →</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Advocacy panel */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Take Action</Text>
          <Text style={styles.sectionSub}>Generate AI-drafted advocacy content for this bill.</Text>

          {/* Channel tabs */}
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

          {/* Rep picker for email */}
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
              {selectedRep && <Text style={styles.repPickerHint}>{selectedRep.title}</Text>}
            </View>
          )}

          {/* Tone picker for email */}
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
                    Generate {activeChannel === 'email'
                      ? `Email to ${selectedRep?.name?.split(' ').pop() || 'Representative'}`
                      : activeChannel === 'tweet' ? 'Tweet' : 'Call Script'}
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
                    ? `Email to ${selectedRep?.name || 'Representative'}`
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
                    onPress={() => Linking.openURL(`https://twitter.com/intent/tweet?text=${encodeURIComponent(currentContent)}`)}
                  >
                    <Ionicons name="logo-twitter" size={16} color="#fff" />
                    <Text style={styles.actionPrimaryText}>Post Tweet</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Source link */}
        {bill.url ? (
          <View style={styles.section}>
            <TouchableOpacity style={styles.sourceBtn} onPress={() => Linking.openURL(bill.url)}>
              <Ionicons name="open-outline" size={16} color="#1a3c5e" />
              <Text style={styles.sourceBtnText}>
                View on {bill.government_level === 'federal' ? 'Congress.gov' : 'OpenStates'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const C = { navy: '#1a3c5e', amber: '#f59e0b', bg: '#f8f9fa', text: '#111', sub: '#666' };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },
  topBar: { backgroundColor: C.navy, paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 4, alignSelf: 'flex-start' },
  hero: { backgroundColor: C.navy, paddingHorizontal: 20, paddingBottom: 24 },
  heroMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  levelBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  levelText: { fontSize: 11, fontWeight: '700' },
  billNumber: { fontSize: 13, fontWeight: '700', color: '#a8c4d8' },
  heroTitle: { fontSize: 19, fontWeight: '800', color: '#fff', lineHeight: 26, marginBottom: 10 },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  statusText: { fontSize: 12, color: '#a8c4d8', flex: 1 },
  section: { backgroundColor: '#fff', marginTop: 8, padding: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 4 },
  sectionSub: { fontSize: 13, color: C.sub, marginBottom: 14 },
  description: { fontSize: 14, color: '#444', lineHeight: 22, marginTop: 4 },
  emptyReps: { fontSize: 13, color: '#9ca3af', fontStyle: 'italic' },
  repRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  repIcon: { fontSize: 20, marginTop: 2 },
  repInfo: { flex: 1 },
  repLabel: { fontSize: 11, color: C.sub },
  repName: { fontSize: 14, fontWeight: '600', color: C.text },
  repReason: { fontSize: 11, color: '#888', marginTop: 1, fontStyle: 'italic' },
  repContact: { fontSize: 12, marginTop: 3 },
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
  repPickerHint: { fontSize: 11, color: '#888', fontStyle: 'italic', marginTop: 2 },
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
  sourceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingVertical: 12 },
  sourceBtnText: { fontSize: 14, color: C.navy, fontWeight: '600' },
});
