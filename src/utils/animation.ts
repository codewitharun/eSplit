// src/utils/animation.ts
// Small shared animation helpers - kept here (rather than duplicated in
// PositionRing/GroupCheck) so the same "counts up" feel is reusable
// anywhere a number needs to animate in.

import {useEffect, useState} from 'react';

/**
 * Animates from 0 up to `target` using the same cubic ease-out curve as
 * the approved web mockup's own `animateNumber()` - every time `target`
 * changes (including the very first render), the displayed value counts
 * up from 0 over `duration`ms rather than jumping straight to the final
 * figure. Matches the mockup exactly (it always restarts from 0, not
 * from whatever was on screen before) so switching the All/Groups/
 * Personal toggle re-triggers the same "counting up" feel each time.
 */
export function useCountUp(target: number, duration = 650): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf = 0;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) {
        startTs = ts;
      }
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) {
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
      if (raf) {
        cancelAnimationFrame(raf);
      }
    };
  }, [target, duration]);

  return value;
}
