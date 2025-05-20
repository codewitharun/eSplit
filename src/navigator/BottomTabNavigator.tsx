/* eslint-disable react/no-unstable-nested-components */
import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {Home as HomeIcon, ArrowLeftRight, PlusIcon} from 'lucide-react-native';
import {
  Text,
  View,
  StyleSheet,
  Animated,
  Pressable,
  Platform,
} from 'react-native';

import {Routes} from './constants';
import colors from '../utils/colors';
import GroupManagement from '../screens/AfterLogin/GroupCheck'; // replace with actual screens
const Tab = createBottomTabNavigator();

export default function MyTabs() {
  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        tabBarIcon: ({focused}) => {
          const animatedScale = new Animated.Value(focused ? 1.2 : 1);

          Animated.timing(animatedScale, {
            toValue: focused ? 1.2 : 1,
            duration: 300,
            useNativeDriver: true,
          }).start();

          let iconComponent;
          if (route.name === Routes.Home) {
            iconComponent = <HomeIcon color={colors.grayDark} size={20} />;
          } else if (route.name === Routes.TabTransaction) {
            iconComponent = (
              <ArrowLeftRight color={colors.grayDark} size={20} />
            );
          } else if (route.name === 'ScanQR') {
            iconComponent = <PlusIcon size={32} color={colors.white} />;
          }

          return (
            <View style={{alignItems: 'center'}}>
              {route.name !== 'ScanQR' && focused && (
                <View
                  style={{
                    width: 50,
                    height: 2,
                    backgroundColor: colors.headerColor,
                    borderRadius: 2,
                    marginBottom: 6,
                    position: 'absolute',
                    top: -10,
                  }}
                />
              )}
              <Animated.View
                style={{
                  transform: [{scale: animatedScale}],
                }}>
                {route.name === 'ScanQR' ? (
                  <View style={styles.qrInnerCircle}>{iconComponent}</View>
                ) : (
                  iconComponent
                )}
              </Animated.View>
            </View>
          );
        },
        tabBarLabel: ({focused}) => (
          <Text style={[styles.tabBarLabel, focused && styles.activeLabel]}>
            {route.name === 'ScanQR'
              ? 'Scan QR'
              : route.name === Routes.Home
              ? 'Group Management'
              : 'Profile'}
          </Text>
        ),
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.grayDark,
        tabBarInactiveTintColor: colors.grayDark,
        tabBarStyle: styles.tabBarStyle,
        headerShown: false,
      })}>
      <Tab.Screen name={Routes.Home} component={GroupManagement} options={{}} />

      <Tab.Screen
        name="ScanQR"
        component={GroupManagement} // Replace with your QR Scanner Screen
        options={{
          tabBarButton: props => (
            <Pressable style={styles.qrButtonWrapper} {...props} />
          ),
        }}
      />

      <Tab.Screen
        name={Routes.TabTransaction}
        component={GroupManagement}
        options={{}}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarStyle: {
    backgroundColor: colors.white,
    height: 70,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'absolute',
    bottom: 0,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -1},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabBarLabel: {
    fontSize: 12,
    color: colors.grayDark,
    marginBottom: 20,
    textAlign: 'center',
  },
  activeLabel: {
    color: colors.grayDark,
    fontWeight: '600',
  },
  qrButtonWrapper: {
    top: -25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrInnerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.headerColor,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
