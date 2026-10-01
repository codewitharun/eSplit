// src/services/invite.ts
// The group invite message, shared by Activity's Invite button and the
// Settings group card - one copy so the wording never drifts. Never used
// for personal lists (they have no invite by design).

import {Share} from 'react-native';
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

🔗 Tap to join: https://ezysplit.arun.codes/app/Group-Check/${groupId}

Or open EzySplit and use this join code: ${joinCode}

Let's make splitting simple! 💰`
    : `🎉 Join me on EzySplit!

Manage & split expenses easily.

🔗 https://ezysplit.arun.codes/app/Group-Check/${groupId}`;
}

export async function shareGroupInvite(
  groupId: string,
  groupName?: string,
  joinCode?: string,
): Promise<void> {
  try {
    await Share.share({
      message: buildInviteMessage(groupId, groupName, joinCode),
    });
  } catch (error: any) {
    Toast.show({
      type: 'error',
      text1: 'Sharing failed',
      text2: error?.message,
    });
  }
}
