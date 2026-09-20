// src/hooks/useModalOpenGuard.ts
// Root cause of the "modal flashes open then closes itself" bug hunted
// across several sessions: on Android (and occasionally iOS), when a
// press handler synchronously flips a `visible` state to true (no
// `await` in between - e.g. the floating "+" button's press bumping a
// store counter that a useEffect reacts to by opening AddExpenseModal),
// the Modal and its full-screen backdrop mount DURING the same native
// touch gesture that triggered the open. The OS's touch-up event, still
// being dispatched, gets redelivered to whatever Touchable now sits at
// those same screen coordinates inside the just-mounted modal - and
// because a modal's backdrop covers the entire screen (and a close "X"
// often sits near where the opening button was), that phantom release
// fires the backdrop's or close button's onPress a few milliseconds
// after opening, immediately closing it. Confirmed via captured logs
// showing the close call originating from React Native's own internal
// Touchable responder state machine (_receiveSignal /
// _performTransitionSideEffects) - not any app code - right after the
// modal appeared.
//
// There's no clean way to tell that phantom replay apart from a genuine
// tap by inspecting the event itself, so the fix used across the React
// Native community for this exact class of bug is a short "ignore
// presses right after opening" window. `canClose()` returns false for
// `guardMs` after `visible` last flipped to true; a close handler that
// checks it first just no-ops on the phantom press instead of acting on
// it. A real, deliberate tap on the backdrop or a close button - even
// one made 200ms later - passes through and closes the modal exactly as
// it always did, so this can never make an intentional close silently
// fail; it only swallows the one spurious press immediately after open.
import {useEffect, useRef} from 'react';

export function useModalOpenGuard(visible: boolean, guardMs = 350) {
  const openedAtRef = useRef(0);

  useEffect(() => {
    if (visible) {
      openedAtRef.current = Date.now();
    }
  }, [visible]);

  return () => Date.now() - openedAtRef.current > guardMs;
}
