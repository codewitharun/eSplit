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
    // Was a translucent white overlay (0.08 alpha) over GradientMesh - on
    // every ordinary GlassCard (group rows, expense rows, balance rows...)
    // that let the mesh's blue/green glow bleed through strongly enough to
    // read as "a glowing gradient patch sitting inside a card", which
    // users didn't like. Tinted dark and mostly opaque instead, so the
    // mesh only shows as a faint hint of depth - the one card meant to
    // stand out (Balances' hero "You're owed" card) still uses
    // `surfaceStrong` below, unchanged.
    surface: 'rgba(14,20,34,0.88)',
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
    // --- Added for the 2026 dashboard/nav/header redesign, additively ---
    // brighter gradient-stop siblings of the base brand colors, used only
    // by GradientView fills (hero cards, FAB, swipe-to-confirm) - every
    // key above this line is unchanged so no existing screen is affected.
    blueBright: '#12A8DD',
    tealBright: '#5FEADD',
    greenBright: '#5CE2A6',
    shadow: 'rgba(4,8,20,0.45)',
  },
  radius: {
    sm: 10,
    md: 16,
    lg: 22,
    xl: 28,
    pill: 999,
  },
  space: (n: number) => n * 4,
  // Named gradient stops for GradientView - kept here so the redesign's
  // palette lives in one token file instead of scattered hex literals.
  gradient: {
    hero: ['#00688D', '#0082B0', '#38D9C9'] as string[],
    fab: ['#0082B0', '#38D9C9'] as string[],
    success: ['#2BB673', '#3ECF8E'] as string[],
    danger: ['#D9536B', '#F0819C'] as string[],
    // Deep, muted navy-to-teal for the dashboard's large "Your position"
    // hero card - deliberately darker/less saturated than `hero` above
    // (used for the small header avatar ring), matching the low-key look
    // of the approved dashboard mockup instead of a bright poster-like
    // gradient.
    heroDark: ['#0A1B2C', '#123A46', '#1B4C4A'] as string[],
  },
};

export type Theme = typeof theme;
export default theme;
