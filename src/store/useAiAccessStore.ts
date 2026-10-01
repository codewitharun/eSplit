// src/store/useAiAccessStore.ts
// Whether the signed-in user has access to the "Ask EzySplit" AI, from
// esplit-backend GET /ai/access (admin-managed per user - see the backend's
// lib/aiAccess.js). The AI orb only renders when `enabled` is true. The
// backend also enforces this on every question, so this only decides what
// the UI shows.
//
// Cached per uid for a couple of minutes; AssistantOrb refreshes it when a
// screen with the orb comes into focus, so switching a user on/off in the
// admin panel shows up without an app update.

import auth from '@react-native-firebase/auth';
import {create} from 'zustand';
import {API_BASE_URL} from '../config/urls';

const STALE_MS = 2 * 60 * 1000;

type AiAccessState = {
  uid: string | null;
  enabled: boolean;
  dailyLimit: number | null;
  remaining: number | null;
  fetchedAt: number;
  inFlight: boolean;
  refresh: (force?: boolean) => Promise<void>;
  revoke: () => void;
};

export const useAiAccessStore = create<AiAccessState>((set, get) => ({
  uid: null,
  enabled: false,
  dailyLimit: null,
  remaining: null,
  fetchedAt: 0,
  inFlight: false,
  refresh: async (force = false) => {
    const user = auth().currentUser;
    if (!user) {
      set({uid: null, enabled: false, remaining: null, fetchedAt: 0});
      return;
    }
    const state = get();
    const sameUser = state.uid === user.uid;
    if (!sameUser) {
      // Never show a previous account's access while re-checking.
      set({uid: user.uid, enabled: false, remaining: null, fetchedAt: 0});
    }
    if (
      get().inFlight ||
      (!force && sameUser && Date.now() - state.fetchedAt < STALE_MS)
    ) {
      return;
    }
    set({inFlight: true});
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${API_BASE_URL}/ai/access`, {
        headers: {Authorization: `Bearer ${token}`},
      });
      const body = res.ok ? await res.json() : {enabled: false};
      if (auth().currentUser?.uid !== user.uid) {
        return; // signed out / switched account meanwhile
      }
      set({
        enabled: body.enabled === true,
        dailyLimit:
          typeof body.dailyLimit === 'number' ? body.dailyLimit : null,
        remaining: typeof body.remaining === 'number' ? body.remaining : null,
        fetchedAt: Date.now(),
      });
    } catch {
      // Offline etc. - keep whatever we last knew; fails closed for a new user.
    } finally {
      set({inFlight: false});
    }
  },
  // The backend said no (403 no_access) - hide the button right away.
  revoke: () => set({enabled: false, fetchedAt: Date.now()}),
}));
