import React from 'react';
import {View, Button} from 'react-native';
import {Text} from '../../component/ui/AppText';
import {signOut} from '../../data/auth';

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
