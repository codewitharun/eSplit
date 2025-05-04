import React from 'react';
import {View, StyleSheet, Image, Text, TouchableOpacity} from 'react-native';
import {onGoogleButtonPress} from '../../services/auth';
import firestore from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';

const LoginScreen = () => {
  const handleLogin = async () => {
    try {
      const response = await onGoogleButtonPress();
    } catch (error) {
      console.log('Google sign-in failed', error);
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('../../OIG3.Bom2yHofHmS0g_DVe.jpeg')} // Replace with your logo URL
        style={styles.logo}
      />
      <Text style={styles.title}>Welcome to Expense Tracker</Text>
      <TouchableOpacity style={styles.button} onPress={handleLogin}>
        <View style={styles.gradient}>
          <Image
            source={require('../../Google_Icons-09-512.webp')}
            style={styles.googleLogo}
          />
          <Text style={styles.buttonText}>Google Sign-In</Text>
        </View>
      </TouchableOpacity>
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
});

export default LoginScreen;
