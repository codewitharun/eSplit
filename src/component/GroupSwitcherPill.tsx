// src/component/GroupSwitcherPill.tsx
// A plain "switch group" action - the screen's own title already shows
// the current group's name, so this doesn't repeat it.
//
// Used to jump straight back to the dashboard (navigation.getParent()
// ?.navigate('Group-Check')) - now it opens the SwitchGroupSheet bottom
// sheet instead, so you can jump sideways to a different group directly,
// not just back out to Home.
//
// `iconOnly` renders this as a bare circular chip - same 36px/surfaceStrong
// treatment as HomeIconChip.tsx - instead of the labelled pill, so the two
// sit together as a matched icon-button pair on the header's right side
// rather than one being a wide labelled pill and the other a small plain
// circle on opposite sides of the row (which read as mismatched/cluttered
// - Home and "Switch group" are now always rendered as a pair by the
// screens that use them; see Activity.tsx/Balances.tsx/GroupSettings.tsx).
//
// The sheet's open/close state lives right here rather than being lifted
// into Activity/Balances/GroupSettings - so every existing <GroupSwitcherPill />
// call site keeps working with zero changes.

import {ArrowLeftRight} from 'lucide-react-native';
import React, {useState} from 'react';
import {StyleSheet, Text, TouchableOpacity, ViewStyle} from 'react-native';
import SwitchGroupSheet from './SwitchGroupSheet';
import theme from '../utils/theme';
import {haptics} from '../utils/haptics';
import {BodyFont, moderateScale} from '../utils/fonts';

interface Props {
  // Lets a caller override layout-only props (e.g. zero out the default
  // marginTop when this sits inline next to other text instead of alone
  // below a title).
  style?: ViewStyle;
  // Renders as a bare icon chip (matching HomeIconChip) instead of the
  // labelled pill - see the file header comment above.
  iconOnly?: boolean;
}

const GroupSwitcherPill: React.FC<Props> = ({style, iconOnly}) => {
  const [sheetVisible, setSheetVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={[iconOnly ? styles.chip : styles.pill, style]}
        onPress={() => {
          haptics.tap();
          setSheetVisible(true);
        }}>
        <ArrowLeftRight
          size={iconOnly ? 18 : 12}
          color={iconOnly ? theme.color.ink : theme.color.inkSoft}
        />
        {!iconOnly && <Text style={styles.text}>Switch group</Text>}
      </TouchableOpacity>
      <SwitchGroupSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
    marginTop: 6,
    gap: 6,
  },
  text: {
    fontFamily: BodyFont.semibold,
    color: theme.color.inkSoft,
    fontSize: moderateScale(11.5),
    fontWeight: '600',
  },
  chip: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.surfaceStrong,
    borderWidth: 1,
    borderColor: theme.color.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default GroupSwitcherPill;
