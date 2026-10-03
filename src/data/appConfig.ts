// src/data/appConfig.ts
// appConfig/global - written only by the admin panel (force update gate).
import {doc, getDoc} from '@react-native-firebase/firestore';
import {db} from './firebase';

export interface GlobalAppConfig {
  minSupportedVersion?: string;
  latestVersion?: string;
  updateMessage?: string;
}

// null when the doc doesn't exist yet.
export async function getGlobalAppConfig(): Promise<GlobalAppConfig | null> {
  const snap = await getDoc(doc(db(), 'appConfig', 'global'));
  return snap.exists() ? ((snap.data() || {}) as GlobalAppConfig) : null;
}
