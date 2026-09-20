import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {useAuthStore} from '../store/useAuthStore';

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
  // App.jsx's own auth().onAuthStateChanged listener never clears
  // useAuthStore's `user` on sign-out (only the signed-IN branch calls
  // setUser) - without this, a caller of signOut() would sign out of
  // Firebase/Google but the app would keep rendering AfterLogin's screens
  // until something else happened to touch this store. Centralizing it
  // here means every signOut() caller gets a working logout for free,
  // instead of each one having to remember this second step - a previous
  // stopgap logout button (GroupSettings.tsx) forgot to and was silently
  // broken until this fix.
  useAuthStore.getState().setUser(null);
};

// Permanently deletes this user's own account: their users/{uid} doc,
// and finally their Firebase Auth login itself. The caller (Profile.tsx)
// is responsible for the "you must leave every group first" gate - this
// function assumes that's already true and never touches anything under
// groups/** or any other user's data, matching deleteGroup()'s same
// one-subtree-only guarantee in firestoreLedger.ts. (The old standalone
// personalExpenses collection this used to also clean up was removed
// along with the feature itself - it was never shipped to users, so
// there's no live data anywhere left to worry about orphaning.)
//
// Firestore data is deleted BEFORE the Auth account, deliberately: if the
// Auth deletion below fails (see the reauth handling) after the Firestore
// data is already gone, the user is left signed in with an empty profile
// rather than the reverse (a deleted login but orphaned data still
// sitting in Firestore under an account nobody can sign back into to
// clean up). That "empty profile" state self-heals on its own the next
// time App.jsx's onAuthStateChanged fires (it re-writes the base
// users/{uid} fields with `{merge: true}` on every login) - and by then
// they've just done the fresh sign-in the retry below needed anyway.
export const deleteAccount = async () => {
  const user = auth().currentUser;
  if (!user) {
    throw new Error('You are not signed in.');
  }
  const uid = user.uid;

  await firestore().collection('users').doc(uid).delete();

  try {
    await user.delete();
  } catch (error) {
    // Firebase requires a *recent* sign-in for an operation this
    // sensitive - if this session isn't fresh, this throws instead of
    // deleting. Re-authenticate once with a fresh Google sign-in and
    // retry exactly once rather than failing outright.
    if (error?.code === 'auth/requires-recent-login') {
      try {
        const {idToken} = await GoogleSignin.signIn();
        const credential = auth.GoogleAuthProvider.credential(idToken);
        await user.reauthenticateWithCredential(credential);
        await user.delete();
      } catch (reauthError) {
        throw new Error(
          'For your security, please log out and log back in, then try deleting your account again.',
        );
      }
    } else {
      throw error;
    }
  }

  await GoogleSignin.signOut().catch(() => {});
  useAuthStore.getState().setUser(null);
};
