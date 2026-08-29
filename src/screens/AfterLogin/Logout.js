import React from 'react';
import {View, Text, Button} from 'react-native';
import {signOut} from '../../services/auth';

const LogoutScreen = () => {
  const handleLogout = async () => {
    await signOut();
  };
  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <Text>Are you sure you want to logout?</Text>
      <Button title="Logout" onPress={handleLogout} />
    </View>
  );
};

export default LogoutScreen;
