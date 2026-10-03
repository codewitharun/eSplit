// src/component/AddGroupFab.tsx
// Floating "New group" action on the dashboard and the Groups list - the
// secondary (outlined) variant of ExtendedFab: people icon, collapses to
// icon-only while scrolling. See ExtendedFab.tsx for the create-button
// rule (filled = adds money, outlined = organises). Same export names as
// before so callers didn't need to change.

import {UsersRound} from 'lucide-react-native';
import React from 'react';
import theme from '../utils/theme';
import ExtendedFab from './ExtendedFab';

export const ADD_GROUP_FAB_HEIGHT = 50;
export const ADD_GROUP_FAB_RIGHT = 20;

interface Props {
  bottom: number;
  onPress: () => void;
}

const AddGroupFab: React.FC<Props> = ({bottom, onPress}) => (
  <ExtendedFab
    variant="secondary"
    icon={<UsersRound size={18} color={theme.color.teal} />}
    iconSize={18}
    label="+ New group"
    accessibilityLabel="Create or join a group"
    size={ADD_GROUP_FAB_HEIGHT}
    bottom={bottom}
    right={ADD_GROUP_FAB_RIGHT}
    onPress={onPress}
  />
);

export default AddGroupFab;
