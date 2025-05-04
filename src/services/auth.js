import auth from '@react-native-firebase/auth';
import {GoogleSignin} from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId:
    '564933121716-dp36e59rrft18pnlgjve3gn3edo3vfr7.apps.googleusercontent.com',
});

export const onGoogleButtonPress = async () => {
  const {idToken} = await GoogleSignin.signIn();
  const googleCredential = auth.GoogleAuthProvider.credential(idToken);
  return auth().signInWithCredential(googleCredential);
};

export const signOut = async () => {
  await GoogleSignin.signOut();
  await auth().signOut();
};
