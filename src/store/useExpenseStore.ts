// src/store/useGroupStore.ts
import {create} from 'zustand';

type ExpenseState = {
  groupKey: string | null;
  incomingDeeplink: boolean;
  user: {} | null;
  groupHandled: boolean;
  addExpenseSignal: number; // bumped by the floating "+" button above the tab bar
  setincomingDeeplink: (bool: boolean) => void;
  setGroupHandled: (value: boolean) => void;
  setGroupKey: (groupKey: string | null) => void;
  setUser: (user: {} | null) => void;
  triggerAddExpense: () => void;
  logout: () => void;
};

export const useExpenseState = create<ExpenseState>(set => ({
  groupKey: null,
  user: null,
  groupHandled: false,
  incomingDeeplink: false,
  addExpenseSignal: 0,
  setincomingDeeplink: bool => set({incomingDeeplink: bool}),
  setGroupHandled: value => set({groupHandled: value}),
  setGroupKey: groupKey => set({groupKey}),
  setUser: user => set({user}),
  triggerAddExpense: () =>
    set(state => ({addExpenseSignal: state.addExpenseSignal + 1})),
  logout: () => set({groupKey: null, user: null, groupHandled: false}),
}));
