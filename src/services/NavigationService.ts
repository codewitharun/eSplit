import {createNavigationContainerRef} from '@react-navigation/native';

// Untyped param list on purpose: screens are registered in App.tsx and
// navigated to by name from non-React code (notification taps).
export const navigationRef = createNavigationContainerRef<Record<string, object | undefined>>();

// pop: true - React Navigation 7 pushes a NEW copy of a screen on
// navigate() unless told to pop back to the existing one. Stacked Home
// screens each listen to the add-expense signal, so one "+" tap opened
// the modal 2-3 times.
export function navigate(name: string, params?: object) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params, {pop: true});
  }
}
