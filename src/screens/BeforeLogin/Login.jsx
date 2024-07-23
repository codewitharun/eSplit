import React from 'react';
import {View, Button, StyleSheet} from 'react-native';
import {onGoogleButtonPress} from '../../services/auth';
import {saveTokenToDatabase} from '../../services/firestore';
import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
const LoginScreen = () => {
  const handleLogin = async () => {
    try {
      await onGoogleButtonPress();
    } catch (error) {
      console.log('Google sign-in failed', error);
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Google Sign-In" onPress={handleLogin} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
});

export default LoginScreen;
