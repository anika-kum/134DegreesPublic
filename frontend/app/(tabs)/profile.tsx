// Profile / Settings tab.
// Users can edit all fields collected at onboarding: district, housing status,
// income bracket, dependents, occupation, personal story, phone, and SMS alerts.
// Changes are PATCHed to /auth/profile; a new JWT is returned when district changes
// (since district is encoded in the token) and stored in the Zustand store.

import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Switch,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { useUserStore } from '../../store/userStore';

const DISTRICTS = Array.from({ length: 11 }, (_, i) => i + 1);
const DISTRICT_NAMES: Record<number, string> = {
  1: 'Richmond', 2: 'Marina / Pacific Heights', 3: 'North Beach / Chinatown',
  4: 'Sunset', 5: 'Haight / Fillmore', 6: 'SoMa / Tenderloin',
  7: 'West Portal / Forest Hill', 8: 'Castro / Noe Valley', 9: 'Mission / Bernal',
  10: 'Bayview / Portola', 11: 'Excelsior / Ingleside',
};

const HOUSING_STATUSES = [
  { key: 'renter', label: 'Renter' },
  { key: 'homeowner', label: 'Homeowner' },
  { key: 'experiencing_homelessness', label: 'Experiencing homelessness' },
  { key: 'case_manager', label: 'Case manager / service provider' },
  { key: 'advocate', label: 'Housing advocate / organizer' },
];

const INCOME_BRACKETS = [
  { key: 'extremely_low', label: 'Extremely low (≤30% AMI)' },
  { key: 'very_low', label: 'Very low (31–50% AMI)' },
  { key: 'low', label: 'Low (51–80% AMI)' },
  { key: 'moderate', label: 'Moderate (81–120% AMI)' },
  { key: 'above_moderate', label: 'Above moderate (>120% AMI)' },
];

export default function ProfileScreen() {
  const { user, logout, updateUser } = useUserStore();

  const [form, setForm] = useState({
    name: user?.name ?? '',
    district: user?.district ?? 0,
    housing_status: user?.housing_status ?? '',
    income_bracket: user?.income_bracket ?? '',
    has_children: user?.has_children ?? false,
    occupation: user?.occupation ?? '',
    personal_story: user?.personal_story ?? '',
    tenure_years: user?.tenure_years ? String(user.tenure_years) : '',
    phone: user?.phone ?? '',
    sms_alerts: user?.sms_alerts ?? false,
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const dirty =
    form.name !== (user?.name ?? '') ||
    form.district !== (user?.district ?? 0) ||
    form.housing_status !== (user?.housing_status ?? '') ||
    form.income_bracket !== (user?.income_bracket ?? '') ||
    form.has_children !== (user?.has_children ?? false) ||
    form.occupation !== (user?.occupation ?? '') ||
    form.personal_story !== (user?.personal_story ?? '') ||
    form.tenure_years !== (user?.tenure_years ? String(user.tenure_years) : '') ||
    form.phone !== (user?.phone ?? '') ||
    form.sms_alerts !== (user?.sms_alerts ?? false);

  async function save() {
    if (!form.name.trim()) { Alert.alert('Name required', 'Please enter your name.'); return; }
    if (!form.district) { Alert.alert('District required', 'Please select your district.'); return; }
    setSaving(true);
    try {
      const result = await api.updateProfile({
        ...form,
        tenure_years: form.tenure_years ? Number(form.tenure_years) : null,
        has_children: form.has_children ? 1 : 0,
      });
      updateUser(result.user, result.token);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Avatar */}
          <View style={styles.avatar}>
            <Ionicons name="person-circle" size={72} color="#1a3c5e" />
            <Text style={styles.emailText}>{user?.email}</Text>
          </View>

          {/* Personal info */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Personal Info</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={v => set('name', v)}
              placeholder="Your name"
              placeholderTextColor="#999"
            />
          </View>

          {/* District */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>SF District</Text>
            <Text style={styles.sectionSub}>Determines your Supervisor and the projects most relevant to you.</Text>
            {DISTRICTS.map(d => (
              <TouchableOpacity
                key={d}
                style={[styles.option, form.district === d && styles.optionSelected]}
                onPress={() => set('district', d)}
              >
                <Text style={[styles.optionNum, form.district === d && styles.optionNumSelected]}>D{d}</Text>
                <Text style={[styles.optionLabel, form.district === d && styles.optionLabelSelected]}>{DISTRICT_NAMES[d]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Housing background */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Housing Background</Text>
            <Text style={styles.label}>I am a...</Text>
            {HOUSING_STATUSES.map(s => (
              <TouchableOpacity
                key={s.key}
                style={[styles.option, form.housing_status === s.key && styles.optionSelected]}
                onPress={() => set('housing_status', s.key)}
              >
                <Text style={[styles.optionLabel, form.housing_status === s.key && styles.optionLabelSelected]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
            <Text style={[styles.label, { marginTop: 16 }]}>Income level</Text>
            {INCOME_BRACKETS.map(b => (
              <TouchableOpacity
                key={b.key}
                style={[styles.option, form.income_bracket === b.key && styles.optionSelected]}
                onPress={() => set('income_bracket', b.key)}
              >
                <Text style={[styles.optionLabel, form.income_bracket === b.key && styles.optionLabelSelected]}>{b.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.toggle, form.has_children && styles.toggleOn]}
              onPress={() => set('has_children', !form.has_children)}
            >
              <Text style={[styles.toggleText, form.has_children && styles.toggleTextOn]}>I have children or dependents</Text>
            </TouchableOpacity>
          </View>

          {/* Story */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Your Story</Text>
            <Text style={styles.sectionSub}>Helps the AI write more authentic, personalized advocacy letters.</Text>
            <Text style={styles.label}>Years living in SF</Text>
            <TextInput
              style={styles.input}
              value={form.tenure_years}
              onChangeText={v => set('tenure_years', v)}
              placeholder="7"
              keyboardType="number-pad"
              placeholderTextColor="#999"
            />
            <Text style={styles.label}>Occupation / role</Text>
            <TextInput
              style={styles.input}
              value={form.occupation}
              onChangeText={v => set('occupation', v)}
              placeholder="Teacher, social worker, parent..."
              placeholderTextColor="#999"
            />
            <Text style={styles.label}>Your housing story</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              value={form.personal_story}
              onChangeText={v => set('personal_story', v)}
              placeholder="I've been on the Section 8 waitlist for 4 years and my rent went up 30% this year..."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              placeholderTextColor="#999"
            />
          </View>

          {/* Contact & alerts */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Contact & Alerts</Text>
            <Text style={styles.label}>Phone number</Text>
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={v => set('phone', v)}
              placeholder="+1 415 555 0100"
              keyboardType="phone-pad"
              placeholderTextColor="#999"
            />
            <View style={styles.switchRow}>
              <View style={styles.switchText}>
                <Text style={styles.label}>SMS alerts</Text>
                <Text style={styles.switchSub}>
                  {form.sms_alerts && form.phone
                    ? `Alerts will go to ${form.phone}`
                    : 'Requires a phone number above'}
                </Text>
              </View>
              <Switch
                value={form.sms_alerts}
                onValueChange={v => set('sms_alerts', v)}
                trackColor={{ false: '#e5e7eb', true: '#1a3c5e' }}
                thumbColor="#fff"
                disabled={!form.phone}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, (!dirty || saving) && styles.saveBtnDisabled]}
            onPress={save}
            disabled={!dirty || saving}
          >
            {saving
              ? <ActivityIndicator color="#1a3c5e" />
              : <Text style={styles.saveBtnText}>Save changes</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={18} color="#dc2626" />
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const C = { navy: '#1a3c5e', amber: '#f59e0b', bg: '#f8f9fa', text: '#111', sub: '#666' };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  avatar: { alignItems: 'center', paddingVertical: 24 },
  emailText: { fontSize: 13, color: C.sub, marginTop: 8 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 4 },
  sectionSub: { fontSize: 13, color: C.sub, marginBottom: 12, lineHeight: 18 },
  label: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: '#f9fafb', color: C.text, marginBottom: 16 },
  inputMulti: { height: 88, textAlignVertical: 'top' },
  option: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 14, marginBottom: 8, backgroundColor: '#fff', gap: 10 },
  optionSelected: { borderColor: C.navy, backgroundColor: '#eef3f9' },
  optionNum: { fontSize: 13, fontWeight: '700', color: '#999', width: 28 },
  optionNumSelected: { color: C.navy },
  optionLabel: { fontSize: 14, color: C.text, flex: 1 },
  optionLabelSelected: { fontWeight: '600', color: C.navy },
  toggle: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 14, marginTop: 12, backgroundColor: '#fff' },
  toggleOn: { borderColor: C.navy, backgroundColor: '#eef3f9' },
  toggleText: { fontSize: 14, color: C.sub },
  toggleTextOn: { color: C.navy, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  switchText: { flex: 1, marginRight: 12 },
  switchSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  saveBtn: { backgroundColor: C.amber, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 12 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: C.navy, fontWeight: '700', fontSize: 15 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  logoutText: { fontSize: 15, color: '#dc2626', fontWeight: '600' },
});
