// src/store/useGroupStore.ts
import {create} from 'zustand';

type ExpenseState = {
  groupKey: string | null;
  user: {} | null;
  setGroupKey: (groupKey: string | null) => void;
  setUser: (user: {} | null) => void;
  logout: () => void;
};

export const useExpenseState = create<ExpenseState>(set => ({
  groupKey: null,
  user: null,
  setGroupKey: groupKey => set({groupKey}),
  setUser: user => set({user}),
  logout: () => set({groupKey: null, user: null}),
}));
