import React from 'react';
import {View, Text, StyleSheet, Modal} from 'react-native';
import {useSelector} from 'react-redux';
import {RootState} from '../store/store';
 
const NetworkLostModal = () => {
  const isConnected = useSelector(state => state.user.networkConnection);

  return (
    <Modal visible={!isConnected} transparent animationType="slide">
      <View style={styles.container}>
        <Text style={styles.title}>No Internet Connection</Text>
        <Text style={styles.subText}>
          Please check your network and try again.
        </Text>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subText: {
    fontSize: 16,
    color: '#ffffff',
    marginTop: 8,
  },
});

export default NetworkLostModal;
