import React, {useEffect, useRef} from 'react';
import {View, StyleSheet, Animated, Easing, Dimensions} from 'react-native';

const {width, height} = Dimensions.get('window');

const SplashScreen = ({onAnimationEnd}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const logoAnim = useRef(new Animated.Value(-height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 3,
        duration: 1200,
        useNativeDriver: true,
        easing: Easing.out(Easing.exp),
      }),
      Animated.parallel([
        Animated.timing(logoAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
          easing: Easing.bounce,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      setTimeout(() => {
        onAnimationEnd && onAnimationEnd();
      }, 1000);
    });
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.circle,
          {
            transform: [{scale: scaleAnim}],
          },
        ]}
      />
      <Animated.Image
        source={require('../OIG3.Bom2yHofHmS0g_DVe.jpeg')}
        style={[
          styles.logo,
          {
            transform: [{translateY: logoAnim}],
            opacity: fadeAnim,
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
};

const CIRCLE_SIZE = 100;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: '#E0E0E0', // transparent white-dusty green
    position: 'absolute',
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 100 / 2,
  },
});

export default SplashScreen;
