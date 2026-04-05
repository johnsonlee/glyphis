import { describe, it, expect, mock } from 'bun:test';
import { hostConfig, type Container } from '../src/react/host-config';
import { GlyphisNode, HOST_TYPES } from '../src/react/glyphis-node';

function createContainer(onCommit?: () => void): Container {
  return {
    rootNode: new GlyphisNode(HOST_TYPES.ROOT, {}),
    onCommit: onCommit ?? (() => {}),
  };
}

describe('hostConfig', () => {
  describe('createInstance', () => {
    it('creates GlyphisNode with correct type and props', () => {
      const instance = hostConfig.createInstance('glyphis-view', {
        style: { flex: 1 },
        testID: 'myView',
      });
      expect(instance.type).toBe('glyphis-view');
      expect(instance.props.style).toEqual({ flex: 1 });
      expect(instance.props.testID).toBe('myView');
    });

    it('excludes children prop from node props', () => {
      const instance = hostConfig.createInstance('glyphis-view', {
        style: { flex: 1 },
        children: ['ignored'],
      } as any);
      expect(instance.props.children).toBeUndefined();
    });
  });

  describe('createTextInstance', () => {
    it('creates text leaf node', () => {
      const instance = hostConfig.createTextInstance('Hello world');
      expect(instance.type).toBe(HOST_TYPES.TEXT_LEAF);
      expect(instance.text).toBe('Hello world');
    });
  });

  describe('tree manipulation', () => {
    it('appendInitialChild adds child to parent', () => {
      const parent = new GlyphisNode('glyphis-view', {});
      const child = new GlyphisNode('glyphis-text', {});
      hostConfig.appendInitialChild(parent, child);
      expect(parent.children).toContain(child);
      expect(child.parent).toBe(parent);
    });

    it('appendChild adds child to parent', () => {
      const parent = new GlyphisNode('glyphis-view', {});
      const child = new GlyphisNode('glyphis-text', {});
      hostConfig.appendChild(parent, child);
      expect(parent.children).toContain(child);
    });

    it('removeChild removes child from parent', () => {
      const parent = new GlyphisNode('glyphis-view', {});
      const child = new GlyphisNode('glyphis-text', {});
      parent.appendChild(child);
      hostConfig.removeChild(parent, child);
      expect(parent.children).not.toContain(child);
      expect(child.parent).toBeNull();
    });

    it('insertBefore inserts at correct position', () => {
      const parent = new GlyphisNode('glyphis-view', {});
      const a = new GlyphisNode('glyphis-view', {});
      const b = new GlyphisNode('glyphis-view', {});
      const c = new GlyphisNode('glyphis-view', {});
      parent.appendChild(a);
      parent.appendChild(c);
      hostConfig.insertBefore(parent, b, c);
      expect(parent.children).toEqual([a, b, c]);
    });
  });

  describe('container operations', () => {
    it('appendChildToContainer adds to root node', () => {
      const container = createContainer();
      const child = new GlyphisNode('glyphis-view', {});
      hostConfig.appendChildToContainer(container, child);
      expect(container.rootNode.children).toContain(child);
    });

    it('removeChildFromContainer removes from root node', () => {
      const container = createContainer();
      const child = new GlyphisNode('glyphis-view', {});
      container.rootNode.appendChild(child);
      hostConfig.removeChildFromContainer(container, child);
      expect(container.rootNode.children).not.toContain(child);
    });

    it('insertInContainerBefore inserts before anchor in root node', () => {
      const container = createContainer();
      const a = new GlyphisNode('glyphis-view', {});
      const b = new GlyphisNode('glyphis-view', {});
      container.rootNode.appendChild(b);
      hostConfig.insertInContainerBefore(container, a, b);
      expect(container.rootNode.children).toEqual([a, b]);
    });
  });

  describe('prepareUpdate', () => {
    it('returns null when props are unchanged', () => {
      const instance = new GlyphisNode('glyphis-view', { style: { flex: 1 } });
      const style = { flex: 1 };
      const result = hostConfig.prepareUpdate(instance, 'glyphis-view', { style }, { style });
      expect(result).toBeNull();
    });

    it('returns diff when style changes', () => {
      const instance = new GlyphisNode('glyphis-view', {});
      const oldStyle = { flex: 1 };
      const newStyle = { flex: 2 };
      const result = hostConfig.prepareUpdate(
        instance, 'glyphis-view',
        { style: oldStyle },
        { style: newStyle },
      );
      expect(result).not.toBeNull();
      expect(result!.style).toEqual({ flex: 2 });
    });

    it('returns diff when event handler changes', () => {
      const handler1 = () => {};
      const handler2 = () => {};
      const instance = new GlyphisNode('glyphis-view', { onPress: handler1 });
      const result = hostConfig.prepareUpdate(
        instance, 'glyphis-view',
        { onPress: handler1 },
        { onPress: handler2 },
      );
      expect(result).not.toBeNull();
      expect(result!.onPress).toBe(handler2);
    });

    it('detects removed props', () => {
      const instance = new GlyphisNode('glyphis-view', {});
      const result = hostConfig.prepareUpdate(
        instance, 'glyphis-view',
        { testID: 'old' },
        {},
      );
      expect(result).not.toBeNull();
      expect(result!.testID).toBeUndefined();
      expect('testID' in result!).toBe(true);
    });

    it('ignores children prop in diff', () => {
      const instance = new GlyphisNode('glyphis-view', {});
      const result = hostConfig.prepareUpdate(
        instance, 'glyphis-view',
        { children: ['a'] } as any,
        { children: ['b'] } as any,
      );
      expect(result).toBeNull();
    });
  });

  describe('commitUpdate', () => {
    it('applies update payload to instance props', () => {
      const instance = new GlyphisNode('glyphis-view', {
        style: { flex: 1 },
        testID: 'old',
      });
      hostConfig.commitUpdate(
        instance,
        { style: { flex: 2 } },
        'glyphis-view',
        { style: { flex: 1 }, testID: 'old' },
        { style: { flex: 2 }, testID: 'old' },
      );
      expect(instance.props.style).toEqual({ flex: 2 });
      expect(instance.props.testID).toBe('old');
    });

    it('removes props set to undefined in payload', () => {
      const instance = new GlyphisNode('glyphis-view', {
        style: { flex: 1 },
        testID: 'remove-me',
      });
      hostConfig.commitUpdate(
        instance,
        { testID: undefined },
        'glyphis-view',
        { style: { flex: 1 }, testID: 'remove-me' },
        { style: { flex: 1 } },
      );
      expect(instance.props.testID).toBeUndefined();
      expect('testID' in instance.props).toBe(false);
    });
  });

  describe('commitTextUpdate', () => {
    it('updates text content', () => {
      const instance = new GlyphisNode(HOST_TYPES.TEXT_LEAF, {}, 'old');
      hostConfig.commitTextUpdate(instance, 'old', 'new');
      expect(instance.text).toBe('new');
    });
  });

  describe('resetAfterCommit', () => {
    it('calls onCommit callback', () => {
      const onCommit = mock(() => {});
      const container = createContainer(onCommit);
      hostConfig.resetAfterCommit(container);
      expect(onCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe('clearContainer', () => {
    it('removes all children from root node', () => {
      const container = createContainer();
      container.rootNode.appendChild(new GlyphisNode('glyphis-view', {}));
      container.rootNode.appendChild(new GlyphisNode('glyphis-text', {}));
      expect(container.rootNode.children.length).toBe(2);
      hostConfig.clearContainer(container);
      expect(container.rootNode.children.length).toBe(0);
    });
  });

  describe('misc methods', () => {
    it('shouldSetTextContent returns false', () => {
      expect(hostConfig.shouldSetTextContent('glyphis-text', {})).toBe(false);
    });

    it('getPublicInstance returns the instance', () => {
      const node = new GlyphisNode('glyphis-view', {});
      expect(hostConfig.getPublicInstance(node)).toBe(node);
    });

    it('finalizeInitialChildren returns false', () => {
      expect(hostConfig.finalizeInitialChildren()).toBe(false);
    });

    it('getCurrentEventPriority returns DefaultEventPriority', () => {
      expect(hostConfig.getCurrentEventPriority()).toBe(32);
    });

    it('supportsMutation is true', () => {
      expect(hostConfig.supportsMutation).toBe(true);
    });

    it('isPrimaryRenderer is true', () => {
      expect(hostConfig.isPrimaryRenderer).toBe(true);
    });
  });
});
