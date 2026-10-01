// src/services/invite.ts
// Everything about inviting someone to a group, in one place: the message
// text, and the actions behind the in-app InviteSheet (copy, WhatsApp,
// system share). Never used for personal lists (they have no invite).
// Links come from src/config/urls.ts.

import Clipboard from '@react-native-clipboard/clipboard';
import {Linking, Share} from 'react-native';
import {groupInviteUrl} from '../config/urls';
import {haptics} from '../utils/haptics';
import Toast from './toast';

export function buildInviteMessage(
  groupId: string,
  groupName?: string,
  joinCode?: string,
): string {
  const name = groupName || 'my group';
  // The link plus the typeable 6-character join code, so someone can
  // still get in by hand from "Join with a code" if the link itself
  // doesn't redirect cleanly for them.
  return joinCode
    ? `🎉 Join me on EzySplit!

Manage & split expenses easily on "${name}".

🔗 Tap to join: ${groupInviteUrl(groupId)}

Or open EzySplit and use this join code: ${joinCode}

Let's make splitting simple! 💰`
    : `🎉 Join me on EzySplit!

Manage & split expenses easily.

🔗 ${groupInviteUrl(groupId)}`;
}

// @react-native-clipboard/clipboard - the official replacement for RN
// core's removed Clipboard (pinned to 1.14.3 for RN 0.74 / old arch).
export function copyToClipboard(text: string, what: string): void {
  try {
    Clipboard.setString(text);
    haptics.success();
    Toast.show({type: 'success', text1: `${what} copied`});
  } catch {
    haptics.error();
    Toast.show({type: 'error', text1: 'Could not copy'});
  }
}

const WHATSAPP_URL = 'whatsapp://send';

// Whether WhatsApp is installed - InviteSheet only shows its button when it
// is. Needs the `whatsapp` scheme declared: a <queries> entry in
// AndroidManifest.xml (Android 11+) and LSApplicationQueriesSchemes in
// Info.plist (iOS); without those this always answers false.
export async function isWhatsAppAvailable(): Promise<boolean> {
  try {
    return await Linking.canOpenURL(WHATSAPP_URL);
  } catch {
    return false;
  }
}

// Opens WhatsApp with the invite prefilled; falls back to the system share
// sheet if it can't be opened.
export async function shareInviteOnWhatsApp(message: string): Promise<void> {
  try {
    await Linking.openURL(
      `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`,
    );
  } catch {
    await shareInviteViaSystem(message);
  }
}

// Android's own share sheet ("More"). Its colours follow the phone's
// system theme and its "Sharing text" heading is fixed by Android - apps
// can't restyle either, which is why the app uses its own InviteSheet first.
export async function shareInviteViaSystem(message: string): Promise<void> {
  try {
    await Share.share({message}, {dialogTitle: 'Invite to EzySplit'});
  } catch (error: any) {
    Toast.show({
      type: 'error',
      text1: 'Sharing failed',
      text2: error?.message,
    });
  }
}
