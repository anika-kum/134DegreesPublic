// Login screen for returning users. On success, `setAuth` writes the JWT to
// AsyncStorage and updates the Zustand store, which triggers the root layout
// redirect to /(tabs)/.

import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../services/api';
import { useUserStore } from '../../store/userStore';

export default function LoginScreen() {
  const router = useRouter();
  const { setAuth } = useUserStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function login() {
    if (!email || !password) return;
    setLoading(true);
    try {
      const { user, token } = await api.login(email, password);
      await setAuth(user, token);
      // Root layout's useEffect detects user is now set and redirects to /(tabs)/
    } catch (err: any) {
      // Backend returns a generic message for both wrong password and unknown email
      // to prevent account enumeration
      Alert.alert('Login failed', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.sub}>Sign in to continue advocating for SF housing.</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
          placeholderTextColor="#999"
        />

        <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={login} disabled={loading}>
          {loading ? <ActivityIndicator color="#1a3c5e" /> : <Text style={styles.btnText}>Sign In</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/onboard')}>
          <Text style={styles.link}>Don't have an account? Create one</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  backBtn: { padding: 20 },
  backText: { color: '#1a3c5e', fontWeight: '600' },
  content: { paddingHorizontal: 24 },
  title: { fontSize: 28, fontWeight: '800', color: '#111', marginBottom: 6 },
  sub: { fontSize: 14, color: '#666', marginBottom: 32 },
  label: { fontSize: 13, fontWeight: '600', color: '#111', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: '#fff', color: '#111', marginBottom: 16 },
  btn: { backgroundColor: '#f59e0b', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#1a3c5e', fontWeight: '700', fontSize: 16 },
  link: { textAlign: 'center', color: '#1a3c5e', marginTop: 20, fontSize: 14 },
});
