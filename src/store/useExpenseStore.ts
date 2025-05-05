// src/store/useGroupStore.ts
import {create} from 'zustand';

type ExpenseState = {
  groupKey: string | null;
  incomingDeeplink: boolean;
  user: {} | null;
  groupHandled: boolean;
  setincomingDeeplink: (bool: boolean) => void;
  setGroupHandled: (value: boolean) => void;
  setGroupKey: (groupKey: string | null) => void;
  setUser: (user: {} | null) => void;
  logout: () => void;
};

export const useExpenseState = create<ExpenseState>(set => ({
  groupKey: null,
  user: null,
  groupHandled: false,
  incomingDeeplink: false,
  setincomingDeeplink: bool => set({incomingDeeplink: bool}),
  setGroupHandled: value => set({groupHandled: value}),
  setGroupKey: groupKey => set({groupKey}),
  setUser: user => set({user}),
  logout: () => set({groupKey: null, user: null, groupHandled: false}),
}));
