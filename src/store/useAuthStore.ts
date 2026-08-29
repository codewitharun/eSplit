// src/store/useAuthStore.ts
import {create} from 'zustand';

export interface AuthUser {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  setToken: (token: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>(set => ({
  token: null,
  user: null,
  setToken: token => set({token}),
  setUser: user => set({user}),
  logout: () => set({token: null, user: null}),
}));
