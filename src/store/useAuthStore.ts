// src/store/useAuthStore.ts
import {create} from 'zustand';

type AuthState = {
  token: string | null;
  user: {} | null;
  setToken: (token: string | null) => void;
  setUser: (user: {} | null) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>(set => ({
  token: null,
  user: null,
  setToken: token => set({token}),
  setUser: user => set({user}),
  logout: () => set({token: null, user: null}),
}));
