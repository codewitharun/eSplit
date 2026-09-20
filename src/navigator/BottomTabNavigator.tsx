/* eslint-disable react/no-unstable-nested-components */
// src/navigator/BottomTabNavigator.tsx
// Three real destinations - Activity / Balances / You - in a translucent
// glass bar. The "add expense" action used to live as a 4th, label-less
// tab slot with a raised circle breaking the top of the bar; with only
// three real destinations that circle could never sit at the bar's true
// center (it has to occupy one of four equal columns), which read as
// lopsided. It's now a persistent floating button layered above the tab
// bar instead - reachable from any of the three tabs exactly like before
// (same addExpenseSignal store, same listener in Activity.tsx), but
// styled as a standard floating action button rather than forcing the
// tab bar into an asymmetric 4-column layout.
//
// Visual pass matched against the mockup's .bottom-nav/.nav-item/.fab: a
// fully pill-shaped bar inset from both side edges with a visible float
// gap above the home-indicator area (previously a flush, edge-to-edge
// bar with only its TOP corners rounded, which read as a plain slab
// rather than a floating nav pill), a lower-opacity active-tab pill
// closer to the mockup's rgba(255,255,255,0.08), and a blue->green FAB
// matching the mockup's gradient instead of the app's blue->teal one.
// Also lowers both the bar's and FAB's Android `elevation` (14/10 -> 6):
// Android applies an automatic tonal (whitish) overlay to elevated
// surfaces that scales with elevation, and at the old values that
// washed the bar out into the flat "ugly white bar" look reported on a
// real device - iOS is unaffected either way since it only reads the
// shadow* props, not elevation.

import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {
  ArrowLeftRight,
  ListChecks,
  PlusIcon,
  Settings,
} from 'lucide-react-native';
import React, {useEffect} from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import GradientView from '../component/glass/GradientView';
import ActivityScreen from '../screens/AfterLogin/Activity';
import BalancesScreen from '../screens/AfterLogin/Balances';
import GroupSettingsScreen from '../screens/AfterLogin/GroupSettings';
import {useExpenseState} from '../store/useExpenseStore';
import {BodyFont, moderateScale} from '../utils/fonts';
import {haptics} from '../utils/haptics';
import theme from '../utils/theme';
import {Routes} from './constants';

const Tab = createBottomTabNavigator();

const FAB_SIZE = 54;

function AddFab({bottom}: {bottom: number}) {
  const triggerAddExpense = useExpenseState(state => state.triggerAddExpense);
  return (
    <TouchableOpacity
      style={[styles.fabShadow, {bottom}]}
      activeOpacity={0.85}
      onPress={() => {
        haptics.tap();
        triggerAddExpense();
      }}>
      <GradientView
        colors={[theme.color.blueBright, theme.color.green]}
        style={styles.fab}>
        <PlusIcon size={24} color={theme.color.onAccent} />
      </GradientView>
    </TouchableOpacity>
  );
}

// Small translucent pill drawn behind the active tab's icon - a common
// "which tab am I on" affordance in the reference apps that inspired this
// redesign. Purely decorative around the existing icon; doesn't change
// which icon renders or the tap target (that's still the full tab).
function TabIconSlot({
  children,
  focused,
}: {
  children: React.ReactNode;
  focused: boolean;
}) {
  // 0 -> 1 drives both the pill fading/scaling in behind the icon and the
  // icon itself lifting a few px with a slight scale-up, so switching
  // tabs reads as the active icon floating into place rather than the
  // old hard on/off background swap.
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, {
      damping: 14,
      stiffness: 180,
    });
  }, [focused, progress]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{scale: 0.85 + progress.value * 0.15}],
  }));

  const iconLiftStyle = useAnimatedStyle(() => ({
    transform: [{scale: 1 + 0.08 * progress.value}],
  }));

  return (
    <View style={styles.iconSlot}>
      <Animated.View style={[styles.iconSlotPill, pillStyle]} />
      <Animated.View style={iconLiftStyle}>{children}</Animated.View>
    </View>
  );
}

// The pill's own vertical padding, symmetric top AND bottom. Previously
// the bottom side used the device's full safe-area inset (`bottomInset`,
// e.g. ~34 on a home-indicator iPhone) as INTERNAL padding while the top
// used a small fixed value - since that inset already gets applied
// separately below (as external margin, to float the pill above the
// home indicator), padding it AGAIN on the inside made the icon+label
// visibly sit nearer the top of the pill with a dead zone below them,
// which is the "not centered" look reported after the last size pass.
// Kept small and identical on both sides so content centers regardless
// of the device's own safe-area size.
const PILL_VERTICAL_PADDING = 10;
// Rough height of the icon+label content itself inside that padding.
const PILL_CONTENT_HEIGHT = 14;
// Visible transparent gap between the pill's bottom edge and the safe
// area below it, so the bar reads as floating (mockup: bottom:16px)
// rather than flush against the screen edge. This and the device's own
// safe-area inset both belong OUTSIDE the pill (as margin), never as
// padding inside it - see PILL_VERTICAL_PADDING above.
const NAV_FLOAT_GAP = 11;
// How far the pill is inset from each screen edge. With just three tabs,
// the original 16 stretched it nearly edge-to-edge, which read as
// oversized for how little content actually sits in it - a narrower,
// more centered pill suits three icon+label pairs better.
const TAB_BAR_SIDE_INSET = 24;

export default function MainTabs() {
  // Real, per-device answer to "how much room does the current navigation
  // mode need at the bottom" - larger under gesture navigation's floating
  // handle, smaller (sometimes ~0) under 3-button nav's own opaque bar.
  // This app draws edge-to-edge on every Android version (see
  // MainActivity.kt), so nothing else accounts for that space
  // automatically - it has to be read here and added on top of the bar's
  // own content height, rather than guessed with a fixed number.
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 5);
  // The pill's own fixed height, symmetric padding on both sides -
  // always the same regardless of device, so it never looks top- or
  // bottom-heavy the way a safe-area-sized bottom padding did.
  const pillHeight = PILL_CONTENT_HEIGHT + PILL_VERTICAL_PADDING * 2;
  // Everything between the pill's bottom edge and the true screen edge -
  // the transparent float gap plus the device's own safe-area clearance -
  // lives entirely in margin, outside the pill, never inside it.
  const marginBelowPill = NAV_FLOAT_GAP + bottomInset;
  const tabBarHeight = pillHeight + marginBelowPill;

  return (
    <View style={styles.flex}>
      <Tab.Navigator
        // The floating pill's own inset margins/corners leave transparent
        // gaps around it (by design, so it reads as floating) - those
        // gaps show whatever sits BEHIND the tab bar row, which without
        // an explicit background here is react-navigation's default
        // light theme color, not this app's dark ground. That's what
        // showed up as a stray white bar around/behind the pill on a
        // real device. sceneContainerStyle covers each screen's own
        // background for the same reason.
        sceneContainerStyle={{backgroundColor: theme.color.ground}}
        screenOptions={({route}) => ({
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: theme.color.ink,
          tabBarInactiveTintColor: theme.color.inkFaint,
          tabBarStyle: [
            styles.tabBar,
            {
              height: tabBarHeight,
              paddingTop: PILL_VERTICAL_PADDING,
              paddingBottom: PILL_VERTICAL_PADDING,
              marginBottom: marginBelowPill,
            },
          ],
          tabBarLabelStyle: styles.tabLabel,
          tabBarIcon: ({color, focused}) => {
            if (route.name === Routes.TabTransaction) {
              return (
                <TabIconSlot focused={focused}>
                  <ListChecks color={color} size={focused ? 20 : 18} />
                </TabIconSlot>
              );
            }
            if (route.name === Routes.BalanceHistory) {
              return (
                <TabIconSlot focused={focused}>
                  <ArrowLeftRight color={color} size={focused ? 20 : 18} />
                </TabIconSlot>
              );
            }
            if (route.name === Routes.GroupSettings) {
              return (
                <TabIconSlot focused={focused}>
                  <Settings color={color} size={focused ? 20 : 18} />
                </TabIconSlot>
              );
            }
            return null;
          },
        })}>
        <Tab.Screen
          name={Routes.TabTransaction}
          component={ActivityScreen}
          options={{title: 'Activity'}}
        />
        <Tab.Screen
          name={Routes.BalanceHistory}
          component={BalancesScreen}
          options={{title: 'Balances'}}
        />
        <Tab.Screen
          name={Routes.GroupSettings}
          component={GroupSettingsScreen}
          options={{title: 'Settings'}}
        />
      </Tab.Navigator>
      <AddFab bottom={tabBarHeight + 46} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1, backgroundColor: theme.color.ground},
  tabBar: {
    // Glass-morphism, not fully transparent: a plain see-through bar let
    // scrolled content collide directly with the icons/labels (unreadable
    // overlap, reported after the last pass) - this project has no real
    // backdrop-blur module (see GlassCard.tsx's own note on why), so the
    // "glass" look here is the same translucent-tint + soft-border recipe
    // GlassCard already uses everywhere else, not an actual blur.
    backgroundColor: 'rgba(8,12,22,0.82)',
    borderWidth: 1,
    borderColor: theme.color.border,
    // react-navigation's own default tab bar style sets borderTopWidth/
    // borderTopColor as their own separate keys (not the generic
    // borderWidth/borderColor above), merged onto this same view -  so a
    // plain borderWidth:0 never actually cleared them, which is what the
    // stray grey hairline sitting on top of the bar turned out to be.
    // Pinning both explicitly here is what actually overrides it.
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    borderRadius: theme.radius.pill,
    marginHorizontal: TAB_BAR_SIDE_INSET,
    paddingTop: 8,
    // Floating overlay, not a row that reserves its own space: with this,
    // each screen renders at full height and its scrollable content
    // continues underneath the bar instead of stopping short of it - the
    // actual "content scrolling below the bottom tab" effect. Every
    // screen that scrolls needs its own bottom padding of at least the
    // real bar height (via useBottomTabBarHeight()) so nothing starts out
    // hidden underneath it at rest - see Activity.tsx, Balances.tsx and
    // GroupSettings.tsx.
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  tabLabel: {
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(10),
    fontWeight: '700',
    letterSpacing: 0.15,
    marginTop: 2,
  },
  iconSlot: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlotPill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  fabShadow: {
    position: 'absolute',
    right: 24,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    shadowColor: theme.color.greenBright,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 8},
    elevation: 6,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
