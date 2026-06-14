// 4-step account creation flow:
//   Step 0 — Account: name, email, password, optional phone
//   Step 1 — District: SF supervisorial district picker (D1–D11)
//   Step 2 — Background: housing status, income bracket, dependents toggle
//   Step 3 — Context: tenure, occupation, personal story, SMS opt-in
//
// All form state is held in a single object so the final submit can send
// everything in one POST. Collected user context is passed to Claude when
// generating advocacy emails, so richer answers → more personalized output.

import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  { key: 'extremely_low', label: 'Extremely low income (≤30% AMI)' },
  { key: 'very_low', label: 'Very low income (31–50% AMI)' },
  { key: 'low', label: 'Low income (51–80% AMI)' },
  { key: 'moderate', label: 'Moderate income (81–120% AMI)' },
  { key: 'above_moderate', label: 'Above moderate (>120% AMI)' },
];

const STEPS = ['Account', 'District', 'Background', 'Context'];

export default function OnboardScreen() {
  const { setAuth } = useUserStore();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '', email: '', password: '',
    district: 0,
    housing_status: '',
    tenure_years: '',
    income_bracket: '',
    has_children: false,
    occupation: '',
    personal_story: '',
    phone: '',
    sms_alerts: false,
  });

  // Shorthand updater — avoids spreading form manually at every call site
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  async function submit() {
    setLoading(true);
    try {
      const payload = {
        ...form,
        // tenure_years is collected as a string from TextInput; coerce to number or null
        tenure_years: form.tenure_years ? Number(form.tenure_years) : null,
      };
      const { user, token } = await api.register(payload);
      await setAuth(user, token);
      // _layout.tsx's useEffect detects user is now set and redirects to /(tabs)/
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  const steps = [
    // Step 0: Account credentials
    <View key="account" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Create your account</Text>
      <Text style={styles.stepSub}>Your details are used only to personalize your advocacy content.</Text>
      <Input label="Full name" value={form.name} onChangeText={v => set('name', v)} placeholder="Maria Santos" />
      <Input label="Email" value={form.email} onChangeText={v => set('email', v)} placeholder="you@email.com" keyboardType="email-address" autoCapitalize="none" />
      <Input label="Password" value={form.password} onChangeText={v => set('password', v)} placeholder="••••••••" secureTextEntry />
      <Input label="Phone (optional — for SMS alerts)" value={form.phone} onChangeText={v => set('phone', v)} placeholder="+1 415 555 0100" keyboardType="phone-pad" />
    </View>,

    // Step 1: District selection — determines default project filter and supervisor contact
    <View key="district" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Which SF district are you in?</Text>
      <Text style={styles.stepSub}>This determines your Supervisor and the projects most relevant to you.</Text>
      <ScrollView style={styles.optionScroll} showsVerticalScrollIndicator={false}>
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
      </ScrollView>
    </View>,

    // Step 2: Housing background — feeds directly into Claude's buildUserContext()
    <View key="background" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Tell us about your housing situation</Text>
      <Text style={styles.stepSub}>This helps the AI write letters that reflect your real circumstances.</Text>
      <Text style={styles.fieldLabel}>I am a...</Text>
      {HOUSING_STATUSES.map(s => (
        <TouchableOpacity
          key={s.key}
          style={[styles.option, form.housing_status === s.key && styles.optionSelected]}
          onPress={() => set('housing_status', s.key)}
        >
          <Text style={[styles.optionLabel, form.housing_status === s.key && styles.optionLabelSelected]}>{s.label}</Text>
        </TouchableOpacity>
      ))}
      <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Income level</Text>
      {INCOME_BRACKETS.map(b => (
        <TouchableOpacity
          key={b.key}
          style={[styles.option, form.income_bracket === b.key && styles.optionSelected]}
          onPress={() => set('income_bracket', b.key)}
        >
          <Text style={[styles.optionLabel, form.income_bracket === b.key && styles.optionLabelSelected]}>{b.label}</Text>
        </TouchableOpacity>
      ))}
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.toggle, form.has_children && styles.toggleOn]}
          onPress={() => set('has_children', !form.has_children)}
        >
          <Text style={[styles.toggleText, form.has_children && styles.toggleTextOn]}>I have children or dependents</Text>
        </TouchableOpacity>
      </View>
    </View>,

    // Step 3: Optional context — the personal_story field has the highest impact on email quality
    <View key="context" style={styles.stepContent}>
      <Text style={styles.stepTitle}>A little more context</Text>
      <Text style={styles.stepSub}>Optional, but the more you share, the more authentic your letters will be.</Text>
      <Input label="Years living in SF" value={form.tenure_years} onChangeText={v => set('tenure_years', v)} placeholder="7" keyboardType="number-pad" />
      <Input label="Occupation / role" value={form.occupation} onChangeText={v => set('occupation', v)} placeholder="Teacher, social worker, parent..." />
      <Input
        label="Your housing story in 1–2 sentences (optional)"
        value={form.personal_story}
        onChangeText={v => set('personal_story', v)}
        placeholder="I've been on the Section 8 waitlist for 4 years and my rent went up 30% this year..."
        multiline
        numberOfLines={3}
      />
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.toggle, form.sms_alerts && styles.toggleOn]}
          onPress={() => set('sms_alerts', !form.sms_alerts)}
        >
          <Text style={[styles.toggleText, form.sms_alerts && styles.toggleTextOn]}>Send me SMS alerts when subscribed projects open applications</Text>
        </TouchableOpacity>
      </View>
    </View>,
  ];

  // Required fields per step — "Continue" button is disabled until these are satisfied
  const canAdvance = () => {
    if (step === 0) return form.name && form.email && form.password;
    if (step === 1) return form.district > 0;
    if (step === 2) return form.housing_status;
    return true;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Step progress indicator */}
      <View style={styles.progress}>
        {STEPS.map((s, i) => (
          <View key={s} style={styles.progressItem}>
            <View style={[styles.progressDot, i <= step && styles.progressDotActive]} />
            <Text style={[styles.progressLabel, i <= step && styles.progressLabelActive]}>{s}</Text>
          </View>
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {steps[step]}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        {step > 0 && (
          <TouchableOpacity style={styles.back} onPress={() => setStep(s => s - 1)}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        )}
        {step < STEPS.length - 1 ? (
          <TouchableOpacity
            style={[styles.next, !canAdvance() && styles.nextDisabled]}
            onPress={() => canAdvance() && setStep(s => s + 1)}
          >
            <Text style={styles.nextText}>Continue</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.next, loading && styles.nextDisabled]} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator color="#1a3c5e" /> : <Text style={styles.nextText}>Create Account</Text>}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

// Reusable labeled text input to reduce per-field boilerplate
function Input({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={[styles.input, props.multiline && styles.inputMulti]} placeholderTextColor="#999" {...props} />
    </View>
  );
}

const C = { bg: '#f8f9fa', navy: '#1a3c5e', amber: '#f59e0b', text: '#111', sub: '#666' };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  progress: { flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 16, gap: 4, justifyContent: 'center' },
  progressItem: { alignItems: 'center', flex: 1 },
  progressDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#d1d5db' },
  progressDotActive: { backgroundColor: C.navy },
  progressLabel: { fontSize: 10, color: '#999', marginTop: 4 },
  progressLabelActive: { color: C.navy, fontWeight: '600' },
  scroll: { flex: 1, paddingHorizontal: 24 },
  stepContent: { paddingBottom: 24 },
  stepTitle: { fontSize: 24, fontWeight: '800', color: C.text, marginBottom: 6 },
  stepSub: { fontSize: 14, color: C.sub, marginBottom: 24, lineHeight: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 6 },
  inputGroup: { marginBottom: 16 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: '#fff', color: C.text },
  inputMulti: { height: 88, textAlignVertical: 'top' },
  optionScroll: { maxHeight: 400 },
  option: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 14, marginBottom: 8, backgroundColor: '#fff', gap: 10 },
  optionSelected: { borderColor: C.navy, backgroundColor: '#eef3f9' },
  optionNum: { fontSize: 13, fontWeight: '700', color: '#999', width: 28 },
  optionNumSelected: { color: C.navy },
  optionLabel: { fontSize: 15, color: C.text, flex: 1 },
  optionLabelSelected: { fontWeight: '600', color: C.navy },
  row: { marginTop: 12 },
  toggle: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 14, backgroundColor: '#fff' },
  toggleOn: { borderColor: C.navy, backgroundColor: '#eef3f9' },
  toggleText: { fontSize: 14, color: C.sub },
  toggleTextOn: { color: C.navy, fontWeight: '600' },
  footer: { flexDirection: 'row', paddingHorizontal: 24, paddingBottom: 32, paddingTop: 12, gap: 12 },
  back: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 20 },
  backText: { color: C.sub, fontWeight: '600' },
  next: { flex: 1, backgroundColor: C.amber, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  nextDisabled: { opacity: 0.5 },
  nextText: { color: C.navy, fontWeight: '700', fontSize: 16 },
});
