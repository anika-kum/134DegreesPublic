// Global auth state using Zustand. Persists token + user profile to AsyncStorage
// so sessions survive app restarts. `loadFromStorage` is called once in _layout.tsx
// on mount; `isLoading: true` prevents flicker before the redirect fires.

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Shape mirrors the backend users table (excluding password_hash)
export interface User {
  id: number;
  email: string;
  name: string;
  district: number;
  housing_status: string;
  tenure_years?: number;
  income_bracket?: string;
  languages?: string[];
  has_children?: boolean;
  occupation?: string;
  personal_story?: string;
  phone?: string;
  sms_alerts?: boolean;
}

interface UserStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  setAuth: (user: User, token: string) => Promise<void>;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  updateUser: (updates: Partial<User>, token?: string) => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  token: null,
  isLoading: true, // stays true until loadFromStorage resolves, blocking redirect logic

  // Called after successful register or login — persists both token and user profile
  setAuth: async (user, token) => {
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    set({ user, token });
  },

  // Clears all auth state and removes stored credentials
  logout: async () => {
    await AsyncStorage.multiRemove(['token', 'user']);
    set({ user: null, token: null });
  },

  // Restores session on app start. `finally` ensures isLoading is cleared even
  // if AsyncStorage is empty or the stored user JSON is malformed.
  loadFromStorage: async () => {
    try {
      const [token, userStr] = await Promise.all([
        AsyncStorage.getItem('token'),
        AsyncStorage.getItem('user'),
      ]);
      if (token && userStr) {
        set({ user: JSON.parse(userStr), token });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  // Optimistically updates the user object in memory + AsyncStorage (no network call).
  // Used after PATCH /auth/profile to reflect profile changes without re-fetching.
  updateUser: (updates, token?) =>
    set((state) => {
      if (!state.user) return {};
      const updated = { ...state.user, ...updates };
      AsyncStorage.setItem('user', JSON.stringify(updated));
      if (token) AsyncStorage.setItem('token', token);
      return { user: updated, ...(token ? { token } : {}) };
    }),
}));
