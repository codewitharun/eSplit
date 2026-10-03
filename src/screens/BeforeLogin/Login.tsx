// src/screens/BeforeLogin/Login.tsx
// Rebuilt on the Phase 3 glass theme - same Google sign-in flow as before,
// now consistent with Activity/Balances/You instead of a plain white card.
//
// Visual refresh: this screen used to sit on a flat, empty background
// with everything dead-centered in one clump - looked plain and dated
// next to the rest of the app's now-modern glass/gradient look. It now
// sits on the same GradientMesh ambient glow every other glass surface
// in the app is built around (a component that existed but was never
// actually mounted anywhere), has a soft gradient ring behind the app
// icon echoing the onboarding carousel's icon-orb motif (so the two
// screens feel like one continuous flow instead of two different apps),
// and a hero-up/card-down layout that breathes instead of stacking
// everything in the middle. None of that touches the actual sign-in
// mechanics below - handleLogin/onGoogleButtonPress/Loader are exactly
// what they were before.

import React, {useEffect, useState} from 'react';
import {Animated, Image, StyleSheet, TouchableOpacity, View} from 'react-native';
import {Text} from '../../component/ui/AppText';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import GlassCard from '../../component/glass/GlassCard';
import GradientMesh from '../../component/glass/GradientMesh';
import GradientView from '../../component/glass/GradientView';
import TechTitanFooter from '../../component/glass/TechTitanFooter';
import Loader from '../../component/loader';
import {onGoogleButtonPress} from '../../data/auth';
import {BodyFont, DisplayFont, moderateScale} from '../../utils/fonts';
import {haptics} from '../../utils/haptics';
import theme from '../../utils/theme';

const LoginScreen = () => {
  const insets = useSafeAreaInsets();
  const [loader, setLoader] = useState(false);

  const logoOpacity = useState(new Animated.Value(0))[0];
  const titleOpacity = useState(new Animated.Value(0))[0];
  const cardY = useState(new Animated.Value(30))[0];

  useEffect(() => {
    Animated.sequence([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(cardY, {
          toValue: 0,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [logoOpacity, titleOpacity, cardY]);

  const handleLogin = async () => {
    try {
      haptics.tap();
      setLoader(true);
      await onGoogleButtonPress();
    } catch (error) {
      console.log('Google sign-in failed', error);
    } finally {
      setLoader(false);
    }
  };

  return (
    <View style={styles.container}>
      <GradientMesh />

      <View
        style={[
          styles.content,
          {paddingTop: insets.top + 48, paddingBottom: insets.bottom + 56},
        ]}>
        <View style={styles.hero}>
          <View style={styles.logoWrap}>
            <GradientView
              colors={theme.gradient.hero}
              style={styles.logoGlow}
            />
            <Animated.Image
              source={require('../../OIG3.Bom2yHofHmS0g_DVe.jpeg')}
              style={[styles.logo, {opacity: logoOpacity}]}
            />
          </View>
          <Animated.View style={{opacity: titleOpacity}}>
            <Text style={styles.kicker}>Welcome to</Text>
            <Text style={styles.title}>EzySplit</Text>
            <Text style={styles.tagline}>
              Split group expenses without the mental math.
            </Text>
          </Animated.View>
        </View>

        <Animated.View
          style={[
            styles.cardWrap,
            {transform: [{translateY: cardY}], opacity: titleOpacity},
          ]}>
          <GlassCard strong style={styles.card}>
            <TouchableOpacity
              style={styles.button}
              onPress={handleLogin}
              activeOpacity={0.85}>
              <Image
                source={require('../../Google_Icons-09-512.webp')}
                style={styles.googleLogo}
              />
              <Text style={styles.buttonText}>Continue with Google</Text>
            </TouchableOpacity>
            <Text style={styles.disclaimer}>
              One account for every group you split expenses with.
            </Text>
          </GlassCard>
        </Animated.View>
      </View>

      <Loader loader={loader} />
      <TechTitanFooter style={styles.footerRow} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.ground,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 56,
  },
  logoWrap: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  logoGlow: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    overflow: 'hidden',
    opacity: 0.4,
  },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 24,
  },
  kicker: {
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(11.5),
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: theme.color.inkFaint,
    textAlign: 'center',
    marginBottom: 6,
  },
  title: {
    fontFamily: DisplayFont.extrabold,
    fontSize: moderateScale(36),
    fontWeight: '800',
    color: theme.color.ink,
    textAlign: 'center',
    marginBottom: 10,
  },
  tagline: {
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(14.5),
    color: theme.color.inkSoft,
    textAlign: 'center',
  },
  cardWrap: {
    width: '100%',
  },
  card: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 28,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderRadius: theme.radius.pill,
  },
  googleLogo: {width: 22, height: 22, marginRight: 12},
  buttonText: {
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(15.5),
    fontWeight: '700',
    color: '#1F1F1F',
  },
  disclaimer: {
    fontFamily: BodyFont.regular,
    marginTop: 16,
    fontSize: moderateScale(12.5),
    color: theme.color.inkFaint,
    textAlign: 'center',
  },
  footerRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default LoginScreen;
