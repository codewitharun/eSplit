import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  TouchableOpacity,
} from 'react-native';
import {User, LogOut} from 'lucide-react-native';
import {useAuthStore} from '../../store/useAuthStore';
import {signOut} from '../../services/auth';

const Header = () => {
  const user = useAuthStore(state => state.user);
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start waving animation with bigger wave
    Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim, {
          toValue: -1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(waveAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const rotate = waveAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ['-30deg', '0deg', '30deg'], // Bigger wave
  });

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.log('Logout Error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Avatar */}
        {user?.photoURL ? (
          <Image source={{uri: user.photoURL}} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <User color="#555" size={26} />
          </View>
        )}

        {/* Center Welcome */}
        <View style={styles.textContainer}>
          <Text style={styles.welcome}>Welcome back,</Text>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{user?.displayName || 'Guest'}</Text>
            <Animated.Text style={[styles.hand, {transform: [{rotate}]}]}>
              👋
            </Animated.Text>
          </View>
          <Text style={styles.tagline}>Ready to manage your tasks?</Text>
        </View>

        {/* Logout */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <LogOut color="#fff" size={20} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0E0E0',
    borderRadius: 20,
    padding: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: {width: 0, height: 2},
    shadowRadius: 4,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 16,
  },
  welcome: {
    color: '#555',
    fontSize: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginRight: 6,
  },
  hand: {
    fontSize: 20,
    color: '#333', // Darker hand color
  },
  tagline: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: '#444',
    padding: 8,
    borderRadius: 16,
  },
});

export default Header;
