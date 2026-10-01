// src/store/useFloatingUiStore.ts
// Whether the floating create buttons ("Add expense", "New group") are
// shown compact (icon only) or extended (icon + label). Driven by scroll
// direction via useCollapseFabsOnScroll - extended at the top of a list
// and when scrolling up, compact while scrolling down - so the labels
// never sit on top of content someone is reading.

import {create} from 'zustand';

type FloatingUiState = {
  fabCompact: boolean;
  setFabCompact: (compact: boolean) => void;
};

export const useFloatingUiStore = create<FloatingUiState>((set, get) => ({
  fabCompact: false,
  setFabCompact: compact => {
    if (get().fabCompact !== compact) {
      set({fabCompact: compact});
    }
  },
}));
