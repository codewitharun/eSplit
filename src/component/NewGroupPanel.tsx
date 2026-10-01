// src/component/NewGroupPanel.tsx
// "New group" opens in a genie panel growing out of the floating button
// (same motion as the AI orb's chat) instead of pushing a full page. The
// content is the same create/join form the old page used.

import {UsersRound} from 'lucide-react-native';
import React from 'react';
import {CreateJoinGroupForm} from '../screens/AfterLogin/CreateJoinGroup';
import {GroupType} from '../services/ledger/types';
import theme from '../utils/theme';
import GeniePanel, {GenieOrigin} from './GeniePanel';
import PanelHeader from './PanelHeader';

interface Props {
  open: boolean;
  onClose: () => void;
  origin: GenieOrigin;
  enterGroup: (
    groupId: string,
    currency?: string,
    type?: GroupType,
  ) => Promise<void>;
}

const NewGroupPanel: React.FC<Props> = ({
  open,
  onClose,
  origin,
  enterGroup,
}) => (
  <GeniePanel open={open} origin={origin} onRequestClose={onClose}>
    <PanelHeader
      icon={<UsersRound size={16} color={theme.color.teal} />}
      title="New group"
      subtitle="Create a group or personal list, or join with a code"
      onClose={onClose}
    />
    <CreateJoinGroupForm enterGroup={enterGroup} onDone={onClose} />
  </GeniePanel>
);

export default NewGroupPanel;
