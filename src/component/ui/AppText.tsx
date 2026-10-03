// src/component/ui/AppText.tsx
// Drop-in Text / TextInput that default to the app's body typeface.
//
// The old app set Text.defaultProps.style in App.jsx. React 19 (Expo SDK 57)
// ignores defaultProps on function components, so that silently stopped
// working - these wrappers replace it. The default font goes FIRST in the
// style array, so any explicit fontFamily / Typography.* preset still wins.
import React from 'react';
import {
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native';
import {BodyFont} from '../../utils/fonts';

const base = {fontFamily: BodyFont.regular};

export function Text({
  style,
  ref,
  ...rest
}: TextProps & {ref?: React.Ref<RNText>}) {
  return <RNText ref={ref} {...rest} style={[base, style]} />;
}

export function TextInput({
  style,
  ref,
  ...rest
}: TextInputProps & {ref?: React.Ref<RNTextInput>}) {
  return <RNTextInput ref={ref} {...rest} style={[base, style]} />;
}

// Same name as a type, so `useRef<TextInput>(null)` keeps compiling.
export type Text = RNText;
export type TextInput = RNTextInput;
