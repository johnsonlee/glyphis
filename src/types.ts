import type { Node } from 'yoga-layout';

export interface Style {
  width?: number | `${number}%` | 'auto';
  height?: number | `${number}%` | 'auto';
  minWidth?: number | `${number}%`;
  minHeight?: number | `${number}%`;
  maxWidth?: number | `${number}%`;
  maxHeight?: number | `${number}%`;

  flex?: number;
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | `${number}%` | 'auto';
  flexWrap?: 'nowrap' | 'wrap' | 'wrap-reverse';

  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  alignItems?: 'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  alignSelf?: 'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  alignContent?: 'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'space-between' | 'space-around';

  padding?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  margin?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginHorizontal?: number;
  marginVertical?: number;

  position?: 'relative' | 'absolute';
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;

  borderWidth?: number;
  borderTopWidth?: number;
  borderRightWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
  borderRadius?: number;
  borderColor?: string;

  backgroundColor?: string;
  opacity?: number;
  overflow?: 'visible' | 'hidden' | 'scroll';
  display?: 'flex' | 'none';

  gap?: number;
  rowGap?: number;
  columnGap?: number;

  color?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
  lineHeight?: number;
}

export type RenderCommand =
  | { type: 'rect'; x: number; y: number; width: number; height: number; color: string; borderRadius?: number; opacity?: number; clipId?: number }
  | { type: 'text'; x: number; y: number; text: string; color: string; fontSize: number; fontWeight?: string; fontFamily?: string; textAlign?: string; maxWidth?: number; opacity?: number; clipId?: number }
  | { type: 'border'; x: number; y: number; width: number; height: number; color: string; widths: [number, number, number, number]; borderRadius?: number; opacity?: number; clipId?: number }
  | { type: 'clip-start'; id: number; x: number; y: number; width: number; height: number; borderRadius?: number }
  | { type: 'clip-end'; id: number };

export interface Platform {
  measureText(text: string, fontSize: number, fontFamily?: string, fontWeight?: string): { width: number; height: number };
  render(commands: RenderCommand[]): void;
  getViewport(): { width: number; height: number };
  onInput(callback: (event: InputEvent) => void): void;
}

export type InputEvent =
  | { type: 'pointerdown'; x: number; y: number }
  | { type: 'pointerup'; x: number; y: number }
  | { type: 'pointermove'; x: number; y: number };
