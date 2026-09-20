// src/component/glass/TechTitanLogo.tsx
// Small reusable render of the TechTitan wordmark (see
// src/assets/svgs/techtitanLogo.ts for why it's an embedded SVG string
// rather than an imported .svg file). Used in the "Created with ❤️ by"
// footer on the login screen and the bottom of Profile - anywhere else
// that wants the real logo instead of typing "TechTitan" as plain text.
import React from 'react';
import {SvgXml} from 'react-native-svg';
import {TECHTITAN_LOGO_SVG} from '../../assets/svgs/techtitanLogo';

const ASPECT_RATIO = 1007 / 311;

interface Props {
  height?: number;
}

const TechTitanLogo: React.FC<Props> = ({height = 16}) => (
  <SvgXml
    xml={TECHTITAN_LOGO_SVG}
    height={height}
    width={height * ASPECT_RATIO}
  />
);

export default TechTitanLogo;
