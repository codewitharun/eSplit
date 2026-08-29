// src/services/appAlert.ts
// A themed replacement for React Native's built-in Alert.alert() - same
// dialog role (a modal confirmation with a title, optional message, and a
// row of buttons), styled to match the app's dark glass cards instead of
// the OS's native alert chrome, which reads as jarringly "system UI" next
// to the rest of the app.
//
// Signature intentionally mirrors Alert.alert(title, message, buttons) so
// callers read the same way; only the import changes at each call site.

import {create} from 'zustand';

export interface AppAlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface AppAlertPayload {
  title: string;
  message?: string;
  buttons: AppAlertButton[];
}

interface AppAlertState {
  alert: AppAlertPayload | null;
}

export const useAppAlertStore = create<AppAlertState>(() => ({alert: null}));

function alert(
  title: string,
  message?: string,
  buttons?: AppAlertButton[],
): void {
  useAppAlertStore.setState({
    alert: {
      title,
      message,
      buttons: buttons && buttons.length ? buttons : [{text: 'OK'}],
    },
  });
}

function dismiss(): void {
  useAppAlertStore.setState({alert: null});
}

const AppAlert = {alert, dismiss};
export default AppAlert;
