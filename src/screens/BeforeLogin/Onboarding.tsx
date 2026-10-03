// src/screens/BeforeLogin/Onboarding.tsx
// First-launch intro carousel shown once before the Login screen.
//
// 2026 redesign: each slide shows a small, static preview built from the
// app's real visual language (glass cards, avatars, balance colours)
// instead of a lone icon in a circle, so a new user sees what EzySplit
// actually looks like before signing in. Swiping drives the animations
// (preview parallax/fade, stretching dots) on the UI thread via Reanimated.
//
// Seen-state is unchanged: the same local AsyncStorage key
// (ONBOARDING_SEEN_KEY), read on mount and written on Skip / Get started.
// Nothing else reads or writes it, and Login.tsx is untouched.
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useNavigation} from '@react-navigation/native';
import React, {useEffect, useRef, useState} from 'react';
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {ArrowRight, Check} from 'lucide-react-native';
import {Text} from '../../component/ui/AppText';
import GradientMesh from '../../component/glass/GradientMesh';
import GradientView from '../../component/glass/GradientView';
import {haptics} from '../../utils/haptics';
import {BodyFont, DisplayFont, moderateScale} from '../../utils/fonts';
import theme from '../../utils/theme';

export const ONBOARDING_SEEN_KEY = 'techtitan_onboarding_seen';

type SlideKey = 'split' | 'balances' | 'settle' | 'track';

interface Slide {
  key: SlideKey;
  tag: string;
  accent: string;
  title: string;
  body: string;
}

const SLIDES: Slide[] = [
  {
    key: 'split',
    tag: 'Split',
    accent: theme.color.blueBright,
    title: 'Split any bill in seconds',
    body: 'Equally, by exact amounts or by share. EzySplit does the math for the whole group.',
  },
  {
    key: 'balances',
    tag: 'Balances',
    accent: theme.color.green,
    title: 'Always know who owes what',
    body: 'Balances update live for everyone the moment an expense is added.',
  },
  {
    key: 'settle',
    tag: 'Settle up',
    accent: theme.color.teal,
    title: 'Settle up with UPI',
    body: 'Pay in one tap and mark it settled. No awkward reminders.',
  },
  {
    key: 'track',
    tag: 'Personal',
    accent: theme.color.amber,
    title: 'Track your own spending too',
    body: 'A private list just for you, with a clear view of where your money goes.',
  },
];

// ─────────────────────────── Slide previews ───────────────────────────
// Static mock-ups, deliberately simple Views so they stay cheap to render.

const Avatar: React.FC<{name: string; color: string; size?: number}> = ({
  name,
  color,
  size = 30,
}) => (
  <View
    style={[
      styles.avatar,
      {width: size, height: size, borderRadius: size / 2, backgroundColor: color},
    ]}>
    <Text style={[styles.avatarText, {fontSize: size * 0.42}]}>{name[0]}</Text>
  </View>
);

const Card: React.FC<{style?: any; children: React.ReactNode}> = ({
  style,
  children,
}) => <View style={[styles.card, style]}>{children}</View>;

const SplitPreview = () => (
  <View style={styles.previewStack}>
    <Card>
      <View style={styles.row}>
        <View style={styles.emojiBox}>
          <Text style={styles.emoji}>🍕</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>Dinner at Toit</Text>
          <Text style={styles.cardSub}>You paid · 4 people</Text>
        </View>
        <Text style={styles.amount}>₹2,400</Text>
      </View>
      <View style={styles.segment}>
        {['Equal', 'Exact', 'Shares'].map((s, i) => (
          <View key={s} style={[styles.segItem, i === 0 && styles.segActive]}>
            <Text style={[styles.segText, i === 0 && styles.segTextActive]}>
              {s}
            </Text>
          </View>
        ))}
      </View>
    </Card>
    <Card style={styles.cardTight}>
      {[
        ['Arun', theme.color.blue],
        ['Rahul', '#7C5CE0'],
        ['Sneha', '#D9536B'],
        ['Priya', '#2BB673'],
      ].map(([n, c]) => (
        <View key={n} style={styles.splitRow}>
          <Avatar name={n} color={c} size={26} />
          <Text style={styles.splitName}>{n}</Text>
          <Text style={styles.splitAmt}>₹600</Text>
        </View>
      ))}
    </Card>
  </View>
);

const BalancesPreview = () => (
  <View style={styles.previewStack}>
    <GradientView colors={theme.gradient.heroDark} style={styles.heroCard}>
      <Text style={styles.heroLabel}>You're owed</Text>
      <Text style={styles.heroAmount}>₹1,250</Text>
      <View style={styles.heroBar}>
        <View style={[styles.heroBarFill, {flex: 0.8}]} />
        <View style={[styles.heroBarRose, {flex: 0.2}]} />
      </View>
    </GradientView>
    <Card style={styles.cardTight}>
      {[
        ['Rahul', '#7C5CE0', 'owes you', '₹850', theme.color.green],
        ['Sneha', '#D9536B', 'owes you', '₹700', theme.color.green],
        ['Priya', '#2BB673', 'you owe', '₹300', theme.color.rose],
      ].map(([n, c, label, amt, tone]) => (
        <View key={n} style={styles.splitRow}>
          <Avatar name={n} color={c} size={26} />
          <View style={styles.flex}>
            <Text style={styles.splitName}>{n}</Text>
            <Text style={styles.cardSub}>{label}</Text>
          </View>
          <Text style={[styles.splitAmt, {color: tone}]}>{amt}</Text>
        </View>
      ))}
    </Card>
  </View>
);

const SettlePreview = () => (
  <View style={styles.previewStack}>
    <Card>
      <View style={styles.settleTop}>
        <Avatar name="You" color={theme.color.blue} size={44} />
        <ArrowRight size={20} color={theme.color.inkFaint} />
        <Avatar name="Priya" color="#2BB673" size={44} />
      </View>
      <Text style={styles.settleLabel}>You pay Priya</Text>
      <Text style={styles.settleAmount}>₹300</Text>
      <GradientView
        colors={theme.gradient.fab}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}
        style={styles.upiBtn}>
        <Text style={styles.upiText}>Pay with UPI</Text>
      </GradientView>
    </Card>
    <View style={styles.settledPill}>
      <Check size={16} color={theme.color.onAccent} strokeWidth={3} />
      <Text style={styles.settledText}>Settled · all square with Priya</Text>
    </View>
  </View>
);

const TRACK_BARS: [string, number, string][] = [
  ['🍔', 0.9, theme.color.amber],
  ['🛒', 0.65, theme.color.green],
  ['🚗', 0.45, theme.color.blueBright],
  ['🛍️', 0.3, theme.color.teal],
  ['💡', 0.2, '#7C5CE0'],
];

const TrackPreview = () => (
  <View style={styles.previewStack}>
    <Card>
      <Text style={styles.heroLabelDark}>This month</Text>
      <Text style={styles.trackTotal}>₹18,420</Text>
      <View style={styles.bars}>
        {TRACK_BARS.map(([icon, h, color]) => (
          <View key={icon} style={styles.barCol}>
            <View style={styles.barTrack}>
              <View
                style={[styles.barFill, {height: `${h * 100}%`, backgroundColor: color}]}
              />
            </View>
            <Text style={styles.barIcon}>{icon}</Text>
          </View>
        ))}
      </View>
    </Card>
  </View>
);

const PREVIEWS: Record<SlideKey, React.FC> = {
  split: SplitPreview,
  balances: BalancesPreview,
  settle: SettlePreview,
  track: TrackPreview,
};

// ─────────────────────────── Animated pieces ───────────────────────────

const SlideView: React.FC<{
  slide: Slide;
  index: number;
  width: number;
  scrollX: SharedValue<number>;
}> = ({slide, index, width, scrollX}) => {
  const Preview = PREVIEWS[slide.key];
  const range = [(index - 1) * width, index * width, (index + 1) * width];

  // Preview drifts slower than the page and fades/shrinks at the edges.
  const previewStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateX: interpolate(
          scrollX.value,
          range,
          [width * 0.35, 0, -width * 0.35],
          Extrapolation.CLAMP,
        ),
      },
      {scale: interpolate(scrollX.value, range, [0.9, 1, 0.9], Extrapolation.CLAMP)},
    ],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollX.value, range, [0, 1, 0], Extrapolation.CLAMP),
  }));

  return (
    <View style={[styles.slide, {width}]}>
      <View style={styles.previewArea}>
        <View style={[styles.glow, {backgroundColor: slide.accent}]} />
        <Animated.View style={[styles.previewWrap, previewStyle]}>
          <Preview />
        </Animated.View>
      </View>
      <Animated.View style={[styles.copy, textStyle]}>
        <Text style={[styles.tag, {color: slide.accent}]}>
          {slide.tag.toUpperCase()}
        </Text>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.body}>{slide.body}</Text>
      </Animated.View>
    </View>
  );
};

const Dot: React.FC<{
  index: number;
  width: number;
  scrollX: SharedValue<number>;
}> = ({index, width, scrollX}) => {
  const style = useAnimatedStyle(() => {
    const range = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      width: interpolate(scrollX.value, range, [8, 24, 8], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.value, range, [0.35, 1, 0.35], Extrapolation.CLAMP),
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
};

// ─────────────────────────── Screen ───────────────────────────

const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const listRef = useRef<any>(null);
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);
  // Blank (same background) while the seen-flag check resolves, so someone
  // who has already onboarded never sees a flash of slide 1.
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
    haptics.tap();
    try {
      await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, '1');
    } catch (error) {
      console.log('Could not persist onboarding-seen flag:', error);
    }
    navigation.replace('Login');
  };

  const onScroll = useAnimatedScrollHandler(e => {
    scrollX.value = e.contentOffset.x;
  });

  const handleNext = () => {
    if (index >= SLIDES.length - 1) {
      finish();
      return;
    }
    haptics.tap();
    // Set the index directly: onMomentumScrollEnd isn't reliably fired for
    // a programmatic scroll, which used to leave the button label stale.
    const next = index + 1;
    setIndex(next);
    listRef.current?.scrollToOffset({offset: next * width, animated: true});
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  if (checking) {
    return <View style={styles.container} />;
  }

  const isLast = index === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      <GradientMesh />

      <View style={[styles.topBar, {paddingTop: insets.top + 10}]}>
        <View style={styles.brand}>
          <Image
            source={require('../../OIG3.Bom2yHofHmS0g_DVe.jpeg')}
            style={styles.brandLogo}
          />
          <Text style={styles.brandName}>EzySplit</Text>
        </View>
        {!isLast && (
          <TouchableOpacity
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}
            onPress={finish}
            style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <Animated.FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={item => item.key}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleScrollEnd}
        renderItem={({item, index: i}) => (
          <SlideView slide={item} index={i} width={width} scrollX={scrollX} />
        )}
      />

      <View style={[styles.footer, {paddingBottom: insets.bottom + 20}]}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <Dot key={s.key} index={i} width={width} scrollX={scrollX} />
          ))}
        </View>
        <TouchableOpacity activeOpacity={0.85} onPress={handleNext}>
          <GradientView
            colors={theme.gradient.fab}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
            style={styles.cta}>
            <Text style={styles.ctaText}>{isLast ? 'Get started' : 'Next'}</Text>
            <ArrowRight size={18} color={theme.color.onAccent} strokeWidth={2.5} />
          </GradientView>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const PREVIEW_WIDTH = 300;

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.color.ground},
  flex: {flex: 1},
  row: {flexDirection: 'row', alignItems: 'center'},

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  brand: {flexDirection: 'row', alignItems: 'center', gap: 10},
  brandLogo: {width: 30, height: 30, borderRadius: 9},
  brandName: {
    fontFamily: DisplayFont.bold,
    fontSize: moderateScale(17),
    color: theme.color.ink,
  },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  skipText: {
    fontFamily: BodyFont.semibold,
    fontSize: moderateScale(13),
    color: theme.color.inkSoft,
  },

  // No flex:1 here - in a horizontal list that would fight the explicit
  // width; the list stretches each page to its full height on its own.
  slide: {paddingHorizontal: 28},
  previewArea: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.12,
  },
  previewWrap: {width: PREVIEW_WIDTH, maxWidth: '100%'},
  previewStack: {gap: 12},

  copy: {paddingBottom: 8},
  tag: {
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(12),
    letterSpacing: 1.6,
    marginBottom: 10,
  },
  title: {
    fontFamily: DisplayFont.bold,
    fontSize: moderateScale(28),
    lineHeight: moderateScale(34),
    color: theme.color.ink,
    marginBottom: 10,
  },
  body: {
    fontFamily: BodyFont.regular,
    fontSize: moderateScale(15),
    lineHeight: moderateScale(22),
    color: theme.color.inkSoft,
  },

  footer: {paddingHorizontal: 28, paddingTop: 20, gap: 20},
  dots: {flexDirection: 'row', gap: 6},
  dot: {height: 8, borderRadius: 4, backgroundColor: theme.color.blueBright},
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: theme.radius.pill,
    paddingVertical: 16,
  },
  ctaText: {
    fontFamily: BodyFont.bold,
    fontSize: moderateScale(16),
    color: theme.color.onAccent,
    fontWeight: '700',
  },

  // Preview building blocks
  card: {
    backgroundColor: theme.color.modalSurface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.color.border,
    padding: 16,
  },
  cardTight: {paddingVertical: 8},
  emojiBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.color.groundAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emoji: {fontSize: 20},
  cardTitle: {
    fontFamily: BodyFont.semibold,
    fontSize: 15,
    color: theme.color.ink,
  },
  cardSub: {
    fontFamily: BodyFont.regular,
    fontSize: 12,
    color: theme.color.inkFaint,
    marginTop: 2,
  },
  amount: {fontFamily: DisplayFont.bold, fontSize: 17, color: theme.color.ink},
  segment: {
    flexDirection: 'row',
    marginTop: 14,
    padding: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.color.groundAlt,
  },
  segItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
  },
  segActive: {backgroundColor: theme.color.blue},
  segText: {fontFamily: BodyFont.semibold, fontSize: 12, color: theme.color.inkFaint},
  segTextActive: {color: theme.color.ink},
  avatar: {alignItems: 'center', justifyContent: 'center'},
  avatarText: {fontFamily: BodyFont.bold, color: '#fff'},
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  splitName: {
    flex: 1,
    fontFamily: BodyFont.medium,
    fontSize: 14,
    color: theme.color.ink,
  },
  splitAmt: {fontFamily: BodyFont.bold, fontSize: 14, color: theme.color.inkSoft},

  heroCard: {
    borderRadius: theme.radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.color.border,
    overflow: 'hidden',
  },
  heroLabel: {fontFamily: BodyFont.medium, fontSize: 13, color: theme.color.inkSoft},
  heroLabelDark: {
    fontFamily: BodyFont.medium,
    fontSize: 13,
    color: theme.color.inkFaint,
  },
  heroAmount: {
    fontFamily: DisplayFont.bold,
    fontSize: 34,
    color: theme.color.green,
    marginTop: 2,
  },
  heroBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 14,
    gap: 3,
  },
  heroBarFill: {backgroundColor: theme.color.green, borderRadius: 3},
  heroBarRose: {backgroundColor: theme.color.rose, borderRadius: 3},

  settleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 14,
  },
  settleLabel: {
    textAlign: 'center',
    fontFamily: BodyFont.medium,
    fontSize: 13,
    color: theme.color.inkFaint,
  },
  settleAmount: {
    textAlign: 'center',
    fontFamily: DisplayFont.bold,
    fontSize: 34,
    color: theme.color.ink,
    marginVertical: 4,
  },
  upiBtn: {
    marginTop: 10,
    borderRadius: theme.radius.pill,
    paddingVertical: 12,
    alignItems: 'center',
  },
  upiText: {fontFamily: BodyFont.bold, fontSize: 14, color: theme.color.onAccent},
  settledPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    backgroundColor: theme.color.green,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
  },
  settledText: {
    fontFamily: BodyFont.semibold,
    fontSize: 13,
    color: theme.color.onAccent,
  },

  trackTotal: {
    fontFamily: DisplayFont.bold,
    fontSize: 30,
    color: theme.color.ink,
    marginTop: 2,
  },
  bars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
    height: 130,
  },
  barCol: {alignItems: 'center', width: 36},
  barTrack: {
    flex: 1,
    width: 22,
    borderRadius: 8,
    backgroundColor: theme.color.groundAlt,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {width: '100%', borderRadius: 8},
  barIcon: {fontSize: 16, marginTop: 8},
});

export default OnboardingScreen;
