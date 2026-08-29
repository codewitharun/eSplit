// src/services/toast.ts
// Replaces react-native-toast-message with an in-house toast that matches
// the app's own glass/dark theme instead of that library's default look.
//
// Deliberately keeps the exact same call shape - Toast.show({type, text1,
// text2}) - as react-native-toast-message, so every existing call site
// across the app needed nothing but a changed import line, not a rewrite.
// Backed by Zustand (already a project dependency, used everywhere else
// for shared state) rather than a bespoke event emitter.

import {create} from 'zustand';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  type: ToastType;
  text1?: string;
  text2?: string;
}

interface ToastState {
  toast: ToastMessage | null;
}

export const useToastStore = create<ToastState>(() => ({toast: null}));

let counter = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

export interface ShowToastParams {
  type?: ToastType;
  text1?: string;
  text2?: string;
  visibilityTime?: number; // ms, defaults to 3000 - matches the old library's default
}

function show(params: ShowToastParams): void {
  if (hideTimer) {
    clearTimeout(hideTimer);
  }
  counter += 1;
  const id = counter;
  useToastStore.setState({
    toast: {
      id,
      type: params.type || 'info',
      text1: params.text1,
      text2: params.text2,
    },
  });
  const duration = params.visibilityTime ?? 3000;
  hideTimer = setTimeout(() => {
    // Only clear if nothing newer has replaced this toast already.
    if (useToastStore.getState().toast?.id === id) {
      useToastStore.setState({toast: null});
    }
  }, duration);
}

function hide(): void {
  if (hideTimer) {
    clearTimeout(hideTimer);
  }
  useToastStore.setState({toast: null});
}

const Toast = {show, hide};
export default Toast;
