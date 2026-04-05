import { describe, it, expect } from 'bun:test';
import {
  resolveEdge,
  resolvePadding,
  resolveMargin,
  resolveBorderWidth,
  resolveBorderColor,
  resolveBorderRadius,
  Fragment,
  TextNode,
} from '../src/types';

describe('resolveEdge', () => {
  it('returns specific value when provided', () => {
    expect(resolveEdge(10, 20, 30, 40, true)).toBe(40);
    expect(resolveEdge(10, 20, 30, 40, false)).toBe(40);
  });

  it('returns horizontal value for horizontal edges when no specific value', () => {
    expect(resolveEdge(10, 20, 30, undefined, true)).toBe(20);
  });

  it('returns vertical value for vertical edges when no specific value', () => {
    expect(resolveEdge(10, 20, 30, undefined, false)).toBe(30);
  });

  it('does not return horizontal for vertical edges', () => {
    expect(resolveEdge(10, 20, undefined, undefined, false)).toBe(10);
  });

  it('does not return vertical for horizontal edges', () => {
    expect(resolveEdge(10, undefined, 30, undefined, true)).toBe(10);
  });

  it('returns all value when no specific or directional value', () => {
    expect(resolveEdge(10, undefined, undefined, undefined, true)).toBe(10);
    expect(resolveEdge(10, undefined, undefined, undefined, false)).toBe(10);
  });

  it('returns 0 when nothing is defined', () => {
    expect(resolveEdge(undefined, undefined, undefined, undefined, true)).toBe(0);
    expect(resolveEdge(undefined, undefined, undefined, undefined, false)).toBe(0);
  });

  it('specific takes priority over horizontal', () => {
    expect(resolveEdge(undefined, 5, undefined, 15, true)).toBe(15);
  });

  it('specific takes priority over vertical', () => {
    expect(resolveEdge(undefined, undefined, 5, 15, false)).toBe(15);
  });

  it('specific takes priority over all', () => {
    expect(resolveEdge(5, undefined, undefined, 15, true)).toBe(15);
  });
});

describe('resolvePadding', () => {
  it('returns all zeros for empty style', () => {
    expect(resolvePadding({})).toEqual([0, 0, 0, 0]);
  });

  it('uses padding shorthand for all edges', () => {
    expect(resolvePadding({ padding: 10 })).toEqual([10, 10, 10, 10]);
  });

  it('uses paddingHorizontal for left and right', () => {
    expect(resolvePadding({ paddingHorizontal: 20 })).toEqual([0, 20, 0, 20]);
  });

  it('uses paddingVertical for top and bottom', () => {
    expect(resolvePadding({ paddingVertical: 15 })).toEqual([15, 0, 15, 0]);
  });

  it('specific values override shorthand', () => {
    expect(resolvePadding({
      padding: 10,
      paddingTop: 5,
      paddingRight: 15,
      paddingBottom: 20,
      paddingLeft: 25,
    })).toEqual([5, 15, 20, 25]);
  });

  it('combines horizontal/vertical with shorthand', () => {
    expect(resolvePadding({
      padding: 10,
      paddingHorizontal: 20,
      paddingVertical: 30,
    })).toEqual([30, 20, 30, 20]);
  });

  it('specific overrides horizontal/vertical', () => {
    expect(resolvePadding({
      paddingHorizontal: 20,
      paddingVertical: 30,
      paddingTop: 1,
      paddingLeft: 2,
    })).toEqual([1, 20, 30, 2]);
  });
});

describe('resolveMargin', () => {
  it('returns all zeros for empty style', () => {
    expect(resolveMargin({})).toEqual([0, 0, 0, 0]);
  });

  it('uses margin shorthand for all edges', () => {
    expect(resolveMargin({ margin: 8 })).toEqual([8, 8, 8, 8]);
  });

  it('uses marginHorizontal for left and right', () => {
    expect(resolveMargin({ marginHorizontal: 12 })).toEqual([0, 12, 0, 12]);
  });

  it('uses marginVertical for top and bottom', () => {
    expect(resolveMargin({ marginVertical: 6 })).toEqual([6, 0, 6, 0]);
  });

  it('specific values override shorthand', () => {
    expect(resolveMargin({
      margin: 10,
      marginTop: 2,
      marginRight: 4,
      marginBottom: 6,
      marginLeft: 8,
    })).toEqual([2, 4, 6, 8]);
  });

  it('combines horizontal/vertical with shorthand', () => {
    expect(resolveMargin({
      margin: 5,
      marginHorizontal: 10,
      marginVertical: 15,
    })).toEqual([15, 10, 15, 10]);
  });
});

describe('resolveBorderWidth', () => {
  it('returns all zeros for empty style', () => {
    expect(resolveBorderWidth({})).toEqual([0, 0, 0, 0]);
  });

  it('uses borderWidth shorthand for all edges', () => {
    expect(resolveBorderWidth({ borderWidth: 2 })).toEqual([2, 2, 2, 2]);
  });

  it('specific values override shorthand', () => {
    expect(resolveBorderWidth({
      borderWidth: 1,
      borderTopWidth: 3,
      borderBottomWidth: 5,
    })).toEqual([3, 1, 5, 1]);
  });

  it('specific values with no shorthand', () => {
    expect(resolveBorderWidth({
      borderTopWidth: 1,
      borderRightWidth: 2,
      borderBottomWidth: 3,
      borderLeftWidth: 4,
    })).toEqual([1, 2, 3, 4]);
  });
});

describe('resolveBorderColor', () => {
  it('returns all transparent for empty style', () => {
    expect(resolveBorderColor({})).toEqual(['transparent', 'transparent', 'transparent', 'transparent']);
  });

  it('uses borderColor shorthand for all edges', () => {
    expect(resolveBorderColor({ borderColor: 'red' })).toEqual(['red', 'red', 'red', 'red']);
  });

  it('specific values override shorthand', () => {
    expect(resolveBorderColor({
      borderColor: 'black',
      borderTopColor: 'red',
      borderRightColor: 'blue',
    })).toEqual(['red', 'blue', 'black', 'black']);
  });

  it('specific values with no shorthand', () => {
    expect(resolveBorderColor({
      borderTopColor: 'red',
      borderRightColor: 'green',
      borderBottomColor: 'blue',
      borderLeftColor: 'yellow',
    })).toEqual(['red', 'green', 'blue', 'yellow']);
  });
});

describe('resolveBorderRadius', () => {
  it('returns all zeros for empty style', () => {
    expect(resolveBorderRadius({})).toEqual([0, 0, 0, 0]);
  });

  it('uses borderRadius shorthand for all corners', () => {
    expect(resolveBorderRadius({ borderRadius: 8 })).toEqual([8, 8, 8, 8]);
  });

  it('specific values override shorthand', () => {
    expect(resolveBorderRadius({
      borderRadius: 10,
      borderTopLeftRadius: 5,
      borderBottomRightRadius: 15,
    })).toEqual([5, 10, 15, 10]);
  });

  it('specific values with no shorthand', () => {
    expect(resolveBorderRadius({
      borderTopLeftRadius: 1,
      borderTopRightRadius: 2,
      borderBottomRightRadius: 3,
      borderBottomLeftRadius: 4,
    })).toEqual([1, 2, 3, 4]);
  });
});

describe('Symbols', () => {
  it('Fragment is the correct symbol', () => {
    expect(Fragment).toBe(Symbol.for('glyphis.fragment'));
  });

  it('TextNode is the correct symbol', () => {
    expect(TextNode).toBe(Symbol.for('glyphis.text'));
  });

  it('Fragment and TextNode are different symbols', () => {
    expect(Fragment).not.toBe(TextNode);
  });
});
