import firestore from '@react-native-firebase/firestore';

export const saveTokenToDatabase = async (user, token) => {
  console.log('🚀 ~ saveTokenToDatabase ~ user:', user.uid, token);
  try {
    const resp = await firestore().collection('mobileUser').doc(user.uid).set({
      uid: user.uid,
      displayName: user.displayName,
      email: user.email,
      token: token,
    });
    return resp;
  } catch (error) {
    console.log('🚀 ~ saveTokenToDatabase ~ error:', error);
  }
};

export const getAllTokens = async () => {
  const snapshot = await firestore().collection('mobileUser').get();
  const tokens = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.token) {
      tokens.push(data.token);
    }
  });
  return tokens;
};
