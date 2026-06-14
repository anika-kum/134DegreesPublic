// Landing / splash screen for unauthenticated users.
// "Get Started" → onboarding flow; "I already have an account" → login.

import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.icon}>🏘️</Text>
        <Text style={styles.title}>SF Housing{'\n'}Advocate</Text>
        <Text style={styles.subtitle}>
          Track affordable housing projects, contact your elected officials,
          and make your voice heard — before the hearing.
        </Text>
      </View>

      {/* Feature highlights — give users a reason to sign up before asking for info */}
      <View style={styles.features}>
        {[
          ['📋', 'Live SF project tracking', 'Pre-approval pipeline from SF Planning Commission'],
          ['✉️', 'AI-drafted advocacy', 'Personalized emails, tweets & call scripts in seconds'],
          ['🔔', 'Application alerts', 'SMS the moment a project opens for applications'],
        ].map(([icon, title, desc]) => (
          <View key={title} style={styles.feature}>
            <Text style={styles.featureIcon}>{icon}</Text>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>{title}</Text>
              <Text style={styles.featureDesc}>{desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.primary} onPress={() => router.push('/(auth)/onboard')}>
          <Text style={styles.primaryText}>Get Started</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.secondaryText}>I already have an account</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a3c5e', paddingHorizontal: 24 },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  icon: { fontSize: 56, marginBottom: 12 },
  title: { fontSize: 36, fontWeight: '800', color: '#fff', textAlign: 'center', lineHeight: 42 },
  subtitle: { fontSize: 16, color: '#a8c4d8', textAlign: 'center', marginTop: 16, lineHeight: 24 },
  features: { gap: 16, marginVertical: 24 },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  featureIcon: { fontSize: 22, width: 32 },
  featureText: { flex: 1 },
  featureTitle: { color: '#fff', fontWeight: '600', fontSize: 15 },
  featureDesc: { color: '#a8c4d8', fontSize: 13, marginTop: 2 },
  buttons: { gap: 12, paddingBottom: 32 },
  primary: { backgroundColor: '#f59e0b', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: '#1a3c5e', fontWeight: '700', fontSize: 17 },
  secondary: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  secondaryText: { color: '#a8c4d8', fontSize: 15 },
});
