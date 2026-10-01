// src/services/invite.ts
// Everything about inviting someone to a group, in one place: the message
// text, and the actions behind the in-app InviteSheet (copy, WhatsApp,
// system share). Never used for personal lists (they have no invite).
// Links come from src/config/urls.ts.

import {Clipboard, Linking, Share} from 'react-native';
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

// RN core's Clipboard is deprecated (moving to a community package) but
// still ships in 0.74 - used here to avoid adding a new native module.
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

// Opens WhatsApp with the invite prefilled; falls back to the system share
// sheet if WhatsApp isn't installed.
export async function shareInviteOnWhatsApp(message: string): Promise<void> {
  try {
    await Linking.openURL(
      `whatsapp://send?text=${encodeURIComponent(message)}`,
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
