// src/navigator/AppBottomBar.tsx
// The OUTER bottom nav - Home / Groups / Settings - shown on the
// dashboard (Group-Check), the new Groups list screen, and Profile.
// Visually it's the same floating glass pill as MainTabs
// (BottomTabNavigator.tsx, the Activity/Balances/Settings bar shown once
// you're inside a specific group), reusing its sizing constants so both
// bars read as one consistent nav language - but this one is deliberately
// NOT a real react-navigation Tab.Navigator. Group-Check has an explicit
// deep-link route (`Group-Check/:groupId`, wired in App.jsx's `linking`
// config) that must keep landing route params directly on GroupCheck's
// own `route.params` exactly as it does today; nesting it inside a real
// Tab.Navigator would mean forwarding those params through a second
// navigator layer, which is exactly the kind of change that could
// silently break an already-hardened deep-link/join flow. So instead
// this is a plain presentational bar: three sibling Stack.Screens
// (Group-Check, Groups, Profile) in the same AfterLogin stack, and
// tapping a tab is just `navigation.navigate(...)` between them - no
// route-param plumbing at all, zero risk to the existing deep link.
//
// `useAppBottomBarHeight()` is exported so any screen using this bar can
// reserve exactly enough bottom padding to keep its last item clear of
// the floating pill at rest (same reasoning as MainTabs' own comment on
// why Activity/Balances/GroupSettings each pad their scroll content).

import {useNavigation} from '@react-navigation/native';
import {House as Home, User, Users} from 'lucide-react-native';
import React from 'react';
import {Image, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from '../component/ui/AppText';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuthStore} from '../store/useAuthStore';
import {haptics} from '../utils/haptics';
import {BodyFont, moderateScale} from '../utils/fonts';
import theme from '../utils/theme';

// Mirrors BottomTabNavigator.tsx's own constants exactly, so the two bars
// match pixel-for-pixel. Duplicated rather than imported/shared - see
// that file's own comment history for how carefully these were tuned;
// pulling them into a shared module risks a change here quietly shifting
// the in-group bar too, or vice versa.
const PILL_VERTICAL_PADDING = 10;
// The bar's own content box needs to fit an icon (up to 20px) + a 2px
// gap + a label line underneath it - roughly 20 + 12 (iconSlot's own
// vertical padding) + 2 + ~14 (label line) =~ 48. This was mistakenly
// copied over as 14 (a value from BottomTabNavigator.tsx that's used
// there only as an intermediate FAB-sizing number, never as this bar's
// own content height), which made the whole bar only 34px tall -
// nowhere near enough for icon+label, so the label overflowed above the
// bar's own edges and content below could visually collide with it.
const TAB_CONTENT_HEIGHT = 48;
const NAV_FLOAT_GAP = 11;
const TAB_BAR_SIDE_INSET = 24;

export function useAppBottomBarHeight(): number {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 5);
  const barHeight = TAB_CONTENT_HEIGHT + PILL_VERTICAL_PADDING * 2;
  const marginBelowPill = NAV_FLOAT_GAP + bottomInset;
  return barHeight + marginBelowPill;
}

export type AppBottomBarTab = 'home' | 'groups' | 'settings';

interface TabDef {
  key: AppBottomBarTab;
  label: string;
  route: string;
}

const TABS: TabDef[] = [
  {key: 'home', label: 'Home', route: 'Group-Check'},
  {key: 'groups', label: 'Groups', route: 'Groups'},
  {key: 'settings', label: 'Settings', route: 'Profile'},
];

interface AppBottomBarProps {
  active: AppBottomBarTab;
}

const AppBottomBar: React.FC<AppBottomBarProps> = ({active}) => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const user = useAuthStore(state => state.user);
  const bottomInset = Math.max(insets.bottom, 5);
  const barHeight = TAB_CONTENT_HEIGHT + PILL_VERTICAL_PADDING * 2;
  const marginBelowPill = NAV_FLOAT_GAP + bottomInset;

  const handlePress = (tab: TabDef) => {
    if (tab.key === active) {
      return;
    }
    haptics.tap();
    // navigate (not push) between siblings already on the stack - reuses
    // the existing screen instance instead of stacking up duplicates,
    // the closest plain-stack equivalent to how a real tab bar behaves.
    navigation.navigate(tab.route);
  };

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: PILL_VERTICAL_PADDING,
          paddingBottom: PILL_VERTICAL_PADDING,
          marginBottom: marginBelowPill,
          height: barHeight,
        },
      ]}>
      {TABS.map(tab => {
        const focused = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabItem}
            activeOpacity={0.75}
            onPress={() => handlePress(tab)}>
            <View style={[styles.iconSlot, focused && styles.iconSlotFocused]}>
              {tab.key === 'home' && (
                <Home
                  color={focused ? theme.color.ink : theme.color.inkFaint}
                  size={focused ? 20 : 18}
                />
              )}
              {tab.key === 'groups' && (
                <Users
                  color={focused ? theme.color.ink : theme.color.inkFaint}
                  size={focused ? 20 : 18}
                />
              )}
              {tab.key === 'settings' &&
                (user?.photoURL ? (
                  <Image
                    source={{uri: user.photoURL}}
                    style={[styles.avatar, focused && styles.avatarFocused]}
                  />
                ) : (
                  <User
                    color={focused ? theme.color.ink : theme.color.inkFaint}
                    size={focused ? 20 : 18}
                  />
                ))}
            </View>
            <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(8,12,22,0.82)',
    borderWidth: 1,
    borderColor: theme.color.border,
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    borderRadius: theme.radius.pill,
    marginHorizontal: TAB_BAR_SIDE_INSET,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconSlot: {
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlotFocused: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tabLabel: {
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(10),
    fontWeight: '700',
    letterSpacing: 0.15,
    color: theme.color.inkFaint,
  },
  tabLabelFocused: {
    color: theme.color.ink,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  avatarFocused: {
    borderWidth: 1.5,
    borderColor: theme.color.ink,
  },
});

export default AppBottomBar;
