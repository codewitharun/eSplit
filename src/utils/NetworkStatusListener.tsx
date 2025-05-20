import {useEffect} from 'react';
import {useDispatch} from 'react-redux';
import NetInfo from '@react-native-community/netinfo';
import {updateNetwork} from '../redux/auth';

const NetworkStatusListener = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      dispatch(updateNetwork(!!state.isConnected));
    });

    return unsubscribe;
  }, [dispatch]);

  return null;
};

export default NetworkStatusListener;
