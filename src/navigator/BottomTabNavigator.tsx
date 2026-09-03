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

import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {ArrowLeftRight, ListChecks, PlusIcon, User} from 'lucide-react-native';
import React from 'react';
import {StyleSheet, TouchableOpacity, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import ActivityScreen from '../screens/AfterLogin/Activity';
import BalancesScreen from '../screens/AfterLogin/Balances';
import ProfileScreen from '../screens/AfterLogin/Profile';
import {useExpenseState} from '../store/useExpenseStore';
import {haptics} from '../utils/haptics';
import theme from '../utils/theme';
import {Routes} from './constants';

const Tab = createBottomTabNavigator();

function AddFab({bottom}: {bottom: number}) {
  const triggerAddExpense = useExpenseState(state => state.triggerAddExpense);
  return (
    <TouchableOpacity
      style={[styles.fab, {bottom}]}
      activeOpacity={0.85}
      onPress={() => {
        haptics.tap();
        triggerAddExpense();
      }}>
      <PlusIcon size={26} color={theme.color.onAccent} />
    </TouchableOpacity>
  );
}

// Content height of the bar itself (icons + labels + top padding),
// independent of whatever the device's own system bar needs below it.
const TAB_BAR_CONTENT_HEIGHT = 56;
const TAB_BAR_TOP_PADDING = 8;

export default function MainTabs() {
  // Real, per-device answer to "how much room does the current navigation
  // mode need at the bottom" - larger under gesture navigation's floating
  // handle, smaller (sometimes ~0) under 3-button nav's own opaque bar.
  // This app draws edge-to-edge on every Android version (see
  // MainActivity.kt), so nothing else accounts for that space
  // automatically - it has to be read here and added on top of the bar's
  // own content height, rather than guessed with a fixed number.
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 10);
  const tabBarHeight =
    TAB_BAR_CONTENT_HEIGHT + TAB_BAR_TOP_PADDING + bottomInset;

  return (
    <View style={styles.flex}>
      <Tab.Navigator
        screenOptions={({route}) => ({
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: theme.color.ink,
          tabBarInactiveTintColor: theme.color.inkFaint,
          tabBarStyle: [
            styles.tabBar,
            {height: tabBarHeight, paddingBottom: bottomInset},
          ],
          tabBarLabelStyle: styles.tabLabel,
          tabBarIcon: ({color, focused}) => {
            if (route.name === Routes.TabTransaction) {
              return <ListChecks color={color} size={focused ? 22 : 20} />;
            }
            if (route.name === Routes.BalanceHistory) {
              return <ArrowLeftRight color={color} size={focused ? 22 : 20} />;
            }
            if (route.name === Routes.Profile) {
              return <User color={color} size={focused ? 22 : 20} />;
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
          name={Routes.Profile}
          component={ProfileScreen}
          options={{title: 'You'}}
        />
      </Tab.Navigator>
      <AddFab bottom={tabBarHeight + 16} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
  tabBar: {
    backgroundColor: 'rgba(19,16,25,0.92)',
    borderTopWidth: 1,
    borderTopColor: theme.color.border,
    paddingTop: 8,
  },
  tabLabel: {fontSize: 11, fontWeight: '600'},
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.color.blue,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.color.blue,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 8},
    elevation: 10,
  },
});
