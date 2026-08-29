// src/screens/BeforeLogin/Login.tsx
// Rebuilt on the Phase 3 glass theme - same Google sign-in flow as before,
// now consistent with Activity/Balances/You instead of a plain white card.

import React, {useEffect, useState} from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import GlassCard from '../../component/glass/GlassCard';
import GradientMesh from '../../component/glass/GradientMesh';
import Loader from '../../component/loader';
import {onGoogleButtonPress} from '../../services/auth';
import {haptics} from '../../utils/haptics';
import theme from '../../utils/theme';

const LoginScreen = () => {
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

      <Animated.Image
        source={require('../../OIG3.Bom2yHofHmS0g_DVe.jpeg')}
        style={[styles.logo, {opacity: logoOpacity}]}
      />
      <Animated.Text style={[styles.title, {opacity: titleOpacity}]}>
        EzySplit
      </Animated.Text>
      <Text style={styles.tagline}>
        Split group expenses without the mental math.
      </Text>

      <Animated.View
        style={{
          transform: [{translateY: cardY}],
          opacity: titleOpacity,
          width: '100%',
        }}>
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

      <Loader loader={loader} />
      <Text style={styles.footer}>Created with ❤️ by Arun Kumar</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.color.ground,
    padding: 24,
  },
  logo: {
    width: 96,
    height: 96,
    marginBottom: 20,
    borderRadius: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8,
    color: theme.color.ink,
  },
  tagline: {
    fontSize: 14,
    color: theme.color.inkSoft,
    marginBottom: 40,
    textAlign: 'center',
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
    paddingVertical: 14,
    borderRadius: theme.radius.md,
  },
  googleLogo: {width: 22, height: 22, marginRight: 12},
  buttonText: {fontSize: 15.5, fontWeight: '700', color: '#1F1F1F'},
  disclaimer: {
    marginTop: 16,
    fontSize: 12.5,
    color: theme.color.inkFaint,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    fontSize: 12.5,
    color: theme.color.inkFaint,
  },
});

export default LoginScreen;
