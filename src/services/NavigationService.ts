import {createNavigationContainerRef} from '@react-navigation/native';

// Untyped param list on purpose: screens are registered in App.tsx and
// navigated to by name from non-React code (notification taps).
export const navigationRef = createNavigationContainerRef<Record<string, object | undefined>>();

export function navigate(name: string, params?: object) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}
