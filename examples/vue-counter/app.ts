import { defineComponent, ref, computed, h } from '@vue/runtime-core';
import { render } from '../../src/vue/platform-web';
import { GView, GText, GButton } from '../../src/vue/components';

const Counter = defineComponent({
  setup() {
    const count = ref(0);
    const countColor = computed(() => {
      if (count.value > 0) return '#4CAF50';
      if (count.value < 0) return '#F44336';
      return '#000000';
    });

    const increment = () => count.value++;
    const decrement = () => count.value--;
    const reset = () => count.value = 0;

    return () => h(GView, {
      style: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA', padding: 20 },
    }, [
      h(GText, { style: { fontSize: 32, fontWeight: 'bold', marginBottom: 8 } }, () => 'Vue Counter'),
      h(GText, { style: { fontSize: 72, fontWeight: 'bold', color: countColor.value, marginBottom: 32 } }, () => String(count.value)),
      h(GView, { style: { flexDirection: 'row', gap: 12 } }, [
        h(GButton, { title: '-', onPress: decrement, color: '#F44336', style: { width: 60 } }),
        h(GButton, { title: 'Reset', onPress: reset, color: '#9E9E9E', style: { width: 80 } }),
        h(GButton, { title: '+', onPress: increment, color: '#4CAF50', style: { width: 60 } }),
      ]),
    ]);
  },
});

const App = defineComponent({
  setup() {
    return () => h(GView, { style: { flex: 1, backgroundColor: '#FFFFFF' } }, [
      h(GView, { style: { height: 44, backgroundColor: '#4CAF50' } }),
      h(GView, {
        style: { height: 56, backgroundColor: '#4CAF50', justifyContent: 'center', alignItems: 'center' },
      }, [
        h(GText, { style: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' } }, () => 'Glyph + Vue'),
      ]),
      h(Counter),
    ]);
  },
});

const canvas = document.getElementById('glyph-root') as HTMLCanvasElement;
if (canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  render(App, canvas);
}
