// src/screens/BeforeLogin/Onboarding.tsx
// First-launch intro carousel shown once before the Login screen - a
// quick, swipeable 3-slide walkthrough of what EzySplit actually does.
// Replaces the old experience of landing straight on a bare sign-in
// button with no context, which read as dated next to the rest of the
// app's now-modernized look.
//
// Seen-state is tracked locally via a brand-new AsyncStorage key
// (ONBOARDING_SEEN_KEY below) that nothing else in the app reads or
// writes, so adding it can't affect any existing stored data for any
// existing user - once someone's swiped through it (or hit Skip) once,
// it's marked seen and every future cold start goes straight to Login,
// same as before this screen existed. Login.tsx itself and its Google
// sign-in flow are completely untouched by this change.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useNavigation} from '@react-navigation/native';
import React, {useEffect, useRef, useState} from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  ArrowRight,
  Calculator,
  LucideIcon,
  PieChart,
  ShieldCheck,
} from 'lucide-react-native';
import GradientView from '../../component/glass/GradientView';
import {haptics} from '../../utils/haptics';
import {BodyFont, DisplayFont, moderateScale} from '../../utils/fonts';
import theme from '../../utils/theme';

export const ONBOARDING_SEEN_KEY = 'techtitan_onboarding_seen';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

interface Slide {
  key: string;
  icon: LucideIcon;
  gradient: string[];
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    key: 'split',
    icon: Calculator,
    gradient: theme.gradient.hero,
    title: 'Split any expense, instantly',
    body: 'Add what you spent and divide it evenly or exactly how you want - no mental math, no spreadsheets.',
  },
  {
    key: 'track',
    icon: PieChart,
    gradient: theme.gradient.success,
    title: 'Know who owes what',
    body: 'Real-time balances for every group, updated the moment someone adds an expense.',
  },
  {
    key: 'settle',
    icon: ShieldCheck,
    gradient: [
      theme.color.blueStrong,
      theme.color.blue,
      theme.color.tealBright,
    ],
    title: 'Settle up in one tap',
    body: 'Mark payments done and keep every group squared away - clean history, no awkward reminders.',
  },
];

const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  // Briefly blank (matching background, so imperceptible) while the
  // seen-flag check below resolves - avoids a flash of slide 1 for
  // someone who's already been through onboarding before.
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(ONBOARDING_SEEN_KEY);
        if (seen && !cancelled) {
          navigation.replace('Login');
          return;
        }
      } catch (error) {
        console.log('Could not read onboarding-seen flag:', error);
      }
      if (!cancelled) {
        setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, '1');
    } catch (error) {
      console.log('Could not persist onboarding-seen flag:', error);
    }
    navigation.replace('Login');
  };

  const handleNext = () => {
    haptics.tap();
    if (index >= SLIDES.length - 1) {
      finish();
      return;
    }
    // Was relying on onMomentumScrollEnd (fired by handleScrollEnd below)
    // to advance `index` after this programmatic scroll - that event
    // isn't reliably fired for a JS-driven animated scrollToOffset the
    // way it is for a real swipe gesture, so tapping "Next" moved the
    // FlatList but the button's own label/dots never updated and could
    // look completely unresponsive. Setting `index` directly here makes
    // the button's own state change immediate and independent of whether
    // that native event fires; a manual swipe still updates it via
    // handleScrollEnd as before.
    const nextIndex = index + 1;
    setIndex(nextIndex);
    listRef.current?.scrollToOffset({
      offset: nextIndex * SCREEN_WIDTH,
      animated: true,
    });
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setIndex(next);
  };

  if (checking) {
    return <View style={styles.container} />;
  }

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.skipBtn, {top: insets.top + 12}]}
        hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
        onPress={finish}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={item => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        renderItem={({item}) => {
          const Icon = item.icon;
          return (
            <View style={styles.slide}>
              <GradientView colors={item.gradient} style={styles.iconOrb}>
                <Icon size={40} color={theme.color.ink} />
              </GradientView>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
            </View>
          );
        }}
      />

      <View style={[styles.footer, {paddingBottom: insets.bottom + 20}]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View
              key={s.key}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
        <TouchableOpacity
          style={styles.nextBtn}
          activeOpacity={0.85}
          onPress={handleNext}>
          <Text style={styles.nextText}>{isLast ? 'Get started' : 'Next'}</Text>
          <ArrowRight size={18} color={theme.color.onAccent} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.color.ground},
  skipBtn: {
    position: 'absolute',
    right: 20,
    zIndex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  skipText: {
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(14),
    color: theme.color.inkFaint,
  },
  slide: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconOrb: {
    width: 132,
    height: 132,
    borderRadius: 66,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  title: {
    fontFamily: DisplayFont.bold,
    fontSize: moderateScale(24),
    color: theme.color.ink,
    textAlign: 'center',
    marginBottom: 14,
  },
  body: {
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(15),
    color: theme.color.inkSoft,
    textAlign: 'center',
    lineHeight: moderateScale(22),
  },
  footer: {
    paddingHorizontal: 28,
    paddingTop: 8,
    gap: 24,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.color.border,
  },
  dotActive: {
    width: 22,
    backgroundColor: theme.color.blueBright,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.color.ink,
    borderRadius: theme.radius.pill,
    paddingVertical: 16,
  },
  nextText: {
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(16),
    color: theme.color.onAccent,
    fontWeight: '700',
  },
});

export default OnboardingScreen;
