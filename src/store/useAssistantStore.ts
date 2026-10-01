// src/store/useAssistantStore.ts
// Conversation state for the "Ask EzySplit" AI panel (AssistantOrb +
// AssistantChat). Lives in a store rather than component state so the
// chat survives closing/reopening the panel and moving between the
// dashboard and a group. Tied to the signed-in uid: AssistantChat resets
// it when a different user is signed in, so a previous account's chat is
// never shown after logout/login. In-memory only - nothing is persisted.

import {create} from 'zustand';
import {ChatTurn} from '../services/ai/assistantClient';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isError?: boolean;
  // True for a fresh AI answer that should type itself out once.
  animate?: boolean;
}

type AssistantState = {
  uid: string | null;
  messages: AssistantMessage[];
  history: ChatTurn[];
  remaining: number | null;
  // Kept here (not component state) so a question still in flight when
  // the panel is closed can't be double-sent after reopening it.
  busy: boolean;
  status: string;
  setBusy: (busy: boolean, status?: string) => void;
  ensureUser: (uid: string) => void;
  append: (m: Omit<AssistantMessage, 'id'>) => void;
  addTurn: (turn: ChatTurn) => void;
  setRemaining: (n: number | null) => void;
  markAnimated: (id: string) => void;
  reset: () => void;
};

export const useAssistantStore = create<AssistantState>((set, get) => ({
  uid: null,
  messages: [],
  history: [],
  remaining: null,
  busy: false,
  status: '',
  setBusy: (busy, status = '') => set({busy, status}),
  ensureUser: uid => {
    if (get().uid !== uid) {
      set({uid, messages: [], history: [], remaining: null});
    }
  },
  append: m =>
    set(state => ({
      messages: [
        ...state.messages,
        {...m, id: `${Date.now()}_${state.messages.length}`},
      ],
    })),
  addTurn: turn =>
    set(state => ({history: [...state.history, turn].slice(-6)})),
  setRemaining: remaining => set({remaining}),
  markAnimated: id =>
    set(state => ({
      messages: state.messages.map(m =>
        m.id === id ? {...m, animate: false} : m,
      ),
    })),
  reset: () => set({messages: [], history: []}),
}));
