import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
    webClientId: '81700495261-tblkaqkgefgrs949p2asu1r8g3spquv7.apps.googleusercontent.com',
});

export const onGoogleButtonPress = async () => {
    const { idToken } = await GoogleSignin.signIn();
    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    return auth().signInWithCredential(googleCredential);
};

export const signOut = async () => {
    await GoogleSignin.signOut();
    await auth().signOut();
};
