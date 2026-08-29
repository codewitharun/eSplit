// src/store/useExpenseStore.ts
import {create} from 'zustand';

type ExpenseState = {
  groupKey: string | null;
  user: {} | null;
  addExpenseSignal: number; // bumped by the floating "+" button above the tab bar
  setGroupKey: (groupKey: string | null) => void;
  setUser: (user: {} | null) => void;
  triggerAddExpense: () => void;
  logout: () => void;
};

export const useExpenseState = create<ExpenseState>(set => ({
  groupKey: null,
  user: null,
  addExpenseSignal: 0,
  setGroupKey: groupKey => set({groupKey}),
  setUser: user => set({user}),
  triggerAddExpense: () =>
    set(state => ({addExpenseSignal: state.addExpenseSignal + 1})),
  logout: () => set({groupKey: null, user: null}),
}));
