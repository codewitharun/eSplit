// components/Loader.tsx
import React, {useEffect} from 'react';
import {View, StyleSheet, Image, Dimensions} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import {GestureHandlerRootView} from 'react-native-gesture-handler';

const {width} = Dimensions.get('window');

interface LoaderProps {
  loader: boolean;
}

const Loader: React.FC<LoaderProps> = ({loader}) => {
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (loader) {
      rotation.value = withRepeat(withTiming(360, {duration: 2000}), -1, false);
    } else {
      rotation.value = 0;
    }
  }, [loader]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{rotate: `${rotation.value}deg`}],
  }));

  if (!loader) return null;

  return (
    <GestureHandlerRootView style={StyleSheet.absoluteFill}>
      <View style={styles.overlay}>
        <Animated.Image
          source={require('./../../OIG3.Bom2yHofHmS0g_DVe.jpeg')} // Replace with your path
          style={[styles.image, animatedStyle]}
          resizeMode="contain"
        />
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  image: {
    width: width * 0.2,
    height: width * 0.2,
    borderRadius: 100 / 2,
  },
});

export default Loader;
