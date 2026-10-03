// src/component/glass/TechTitanFooter.tsx
// "Created with ❤️ by [TechTitan logo]" - shared between the login
// screen and the bottom of Profile.tsx so the two copies can't drift out
// of sync (size, spacing, link behavior all live here once). Tapping the
// logo opens techtiten.com in the device's browser.
import React from 'react';
import {Linking, StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle} from 'react-native';
import {Text} from '../ui/AppText';
import Toast from '../../services/toast';
import {BodyFont, moderateScale} from '../../utils/fonts';
import theme from '../../utils/theme';
import TechTitanLogo from './TechTitanLogo';

const TECHTITAN_URL = 'https://techtiten.com';

interface Props {
  style?: StyleProp<ViewStyle>;
}

const TechTitanFooter: React.FC<Props> = ({style}) => {
  const openTechTitan = () => {
    Linking.openURL(TECHTITAN_URL).catch(() => {
      Toast.show({
        type: 'error',
        text1: "Couldn't open link",
        text2: TECHTITAN_URL,
      });
    });
  };

  return (
    <View style={[styles.row, style]}>
      <Text style={styles.text}>Created with ❤️ by</Text>
      <TouchableOpacity
        onPress={openTechTitan}
        hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
        <TechTitanLogo height={30} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  text: {
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(13),
    color: theme.color.inkFaint,
    marginBottom: 2,
  },
});

export default TechTitanFooter;
