import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

const DashedDividerWithText = () => {
  return (
    <View style={styles.container}>
      <View style={styles.dashedWrapper}>
        <View style={styles.dashedLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dashedLine} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  dashedWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '95%', // Adjust the width as needed
  },
  dashedLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    borderStyle: 'dashed',
    flex: 1,
  },
  dividerText: {
    marginHorizontal: 10, // Space between dashed lines and text
    fontSize: 16,
    color: '#000',
  },
});

export default DashedDividerWithText;
