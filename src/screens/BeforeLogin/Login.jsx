import React, {useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  Image,
  Text,
  TouchableOpacity,
  Animated,
} from 'react-native';
import {onGoogleButtonPress} from '../../services/auth';
import Loader from '../../component/loader';

const LoginScreen = () => {
  const [loader, setLoader] = useState(false);

  // Animations for the logo, title, and button
  const logoOpacity = useState(new Animated.Value(0))[0];
  const titleOpacity = useState(new Animated.Value(0))[0];
  const buttonY = useState(new Animated.Value(50))[0]; // Button starts offscreen

  useEffect(() => {
    // Fade in logo and title, slide in button
    Animated.sequence([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(buttonY, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    try {
      setLoader(true);
      const response = await onGoogleButtonPress();
      setLoader(false);
    } catch (error) {
      setLoader(false);
      console.log('Google sign-in failed', error);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require('../../OIG3.Bom2yHofHmS0g_DVe.jpeg')}
        style={[styles.logo, {opacity: logoOpacity}]}
      />
      <Animated.Text style={[styles.title, {opacity: titleOpacity}]}>
        Welcome to EzySplit
      </Animated.Text>
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <View style={styles.gradient}>
          <Image
            source={require('../../Google_Icons-09-512.webp')}
            style={styles.googleLogo}
          />
          <Text style={styles.buttonText}>Google Sign-In</Text>
        </View>
      </TouchableOpacity>
      <Loader loader={loader} />
      <Animated.View
        style={[
          styles.buttonContainer,
          {transform: [{translateY: buttonY}]},
        ]}></Animated.View>
      <Text style={styles.footer}>Created with ❤️ by Appaura</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  logo: {
    width: 150,
    height: 150,
    marginBottom: 32,
    borderRadius: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#333',
  },
  button: {
    borderRadius: 5,
    overflow: 'hidden',
    width: '80%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#333',
    borderRadius: 10,
  },
  googleLogo: {
    width: 24,
    height: 24,
    marginRight: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: 16, // Space for the button after animation
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    fontSize: 16,
    color: '#000000',
    textAlign: 'center',
  },
});

export default LoginScreen;
