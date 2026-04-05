import { describe, it, expect } from 'bun:test';
import { patchProp } from '../src/vue/patch-props';
import { GlyphisNode } from '../src/react/glyphis-node';

describe('Vue patchProp', () => {
  it('sets style', () => {
    const el = new GlyphisNode('glyphis-view', {});
    patchProp(el, 'style', undefined, { flex: 1 });
    expect(el.props.style).toEqual({ flex: 1 });
  });

  it('updates style', () => {
    const el = new GlyphisNode('glyphis-view', { style: { flex: 1 } });
    patchProp(el, 'style', { flex: 1 }, { flex: 2, backgroundColor: 'red' });
    expect(el.props.style).toEqual({ flex: 2, backgroundColor: 'red' });
  });

  it('removes style by setting null', () => {
    const el = new GlyphisNode('glyphis-view', { style: { flex: 1 } });
    patchProp(el, 'style', { flex: 1 }, null);
    expect(el.props.style).toEqual({});
  });

  it('sets event handler (onPress)', () => {
    const el = new GlyphisNode('glyphis-view', {});
    const handler = () => {};
    patchProp(el, 'onPress', undefined, handler);
    expect(el.props.onPress).toBe(handler);
  });

  it('removes event handler by setting undefined', () => {
    const handler = () => {};
    const el = new GlyphisNode('glyphis-view', { onPress: handler });
    patchProp(el, 'onPress', handler, undefined);
    expect(el.props.onPress).toBeUndefined();
  });

  it('removes event handler by setting null', () => {
    const handler = () => {};
    const el = new GlyphisNode('glyphis-view', { onPress: handler });
    patchProp(el, 'onPress', handler, null);
    expect(el.props.onPress).toBeUndefined();
  });

  it('sets generic prop (src)', () => {
    const el = new GlyphisNode('glyphis-image', {});
    patchProp(el, 'src', undefined, 'image.png');
    expect(el.props.src).toBe('image.png');
  });

  it('removes generic prop with undefined', () => {
    const el = new GlyphisNode('glyphis-image', { src: 'image.png' });
    patchProp(el, 'src', 'image.png', undefined);
    expect('src' in el.props).toBe(false);
  });

  it('sets testID prop', () => {
    const el = new GlyphisNode('glyphis-view', {});
    patchProp(el, 'testID', undefined, 'my-view');
    expect(el.props.testID).toBe('my-view');
  });

  it('sets boolean prop', () => {
    const el = new GlyphisNode('glyphis-view', {});
    patchProp(el, 'disabled', undefined, true);
    expect(el.props.disabled).toBe(true);
  });
});
