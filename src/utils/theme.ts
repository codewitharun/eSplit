// src/utils/theme.ts
// Design tokens rebuilt around the actual app icon: a bright money-green
// mascot on a deep blue phone screen, gold coins. Blue is the primary
// brand/action color (buttons, active states, the FAB); green is money-
// positive - tied to both the brand and "settled/owed to you" so the two
// reinforce each other instead of competing. Rose/amber stay reserved for
// owe/pending so semantic meaning never overlaps with brand color.

export const theme = {
  color: {
    ground: '#0A0F1C', // deep blue-black glass world, matches the icon's background
    groundAlt: '#0F1626',
    surface: 'rgba(255,255,255,0.08)',
    surfaceStrong: 'rgba(255,255,255,0.14)',
    // Near-opaque surface for modal sheets/dialogs - unlike `surface` and
    // `surfaceStrong` (deliberately see-through for cards sitting over the
    // GradientMesh), a modal sits over a full screen of readable content
    // and needs to fully hide it, not blend with it.
    modalSurface: '#182338',
    border: 'rgba(255,255,255,0.16)',
    borderStrong: 'rgba(255,255,255,0.26)',
    ink: '#F2F5F9',
    inkSoft: '#AEC3E8',
    inkFaint: '#7C8CAE',
    blue: '#0082B0', // primary brand + actions - matches the app icon's sky blue
    blueStrong: '#00688D',
    teal: '#38D9C9', // secondary accent (links, "Between" chips, etc.)
    green: '#3ECF8E', // money-positive / settled - echoes the icon's mascot green
    rose: '#F0819C', // owe
    amber: '#F0B94D', // pending / gold-coin accent
    onAccent: '#08101F', // text color for anything sitting on a bright accent surface
  },
  radius: {
    sm: 10,
    md: 16,
    lg: 22,
    pill: 999,
  },
  space: (n: number) => n * 4,
};

export type Theme = typeof theme;
export default theme;
