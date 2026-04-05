import { render, View, Text, createWebPlatform, createSignal, createMemo, glyphisRenderer } from '../../src';
import type { Style } from '../../src';

// -- Formatting helpers --

function formatDisplay(value: string): string {
  if (value === 'Error') return 'Error';
  const isNegative = value.startsWith('-');
  const abs = isNegative ? value.slice(1) : value;
  if (abs.includes('.')) {
    const [intPart, decPart] = abs.split('.');
    const result = addCommas(intPart) + '.' + decPart;
    return isNegative ? '-' + result : result;
  }
  return isNegative ? '-' + addCommas(abs) : addCommas(abs);
}

function addCommas(s: string): string {
  if (s.length <= 3) return s;
  const r = s.split('').reverse();
  const chunks: string[] = [];
  for (let i = 0; i < r.length; i += 3) chunks.push(r.slice(i, i + 3).reverse().join(''));
  return chunks.reverse().join(',');
}

function displayFontSize(text: string): number {
  const len = text.replace(/[,.\-]/g, '').length;
  if (len <= 6) return 80;
  if (len <= 7) return 70;
  if (len <= 8) return 60;
  if (len <= 9) return 52;
  return 44;
}

function formatResult(value: number): string {
  if (isNaN(value) || !isFinite(value)) return 'Error';
  if (Math.abs(value) >= 1e15) return value.toExponential(5);
  let str = String(value);
  if (str.includes('.')) str = String(parseFloat(value.toPrecision(9)));
  if (str.replace(/[.\-]/g, '').length > 9) str = String(parseFloat(value.toPrecision(9)));
  return str;
}

const OP_SYM: Record<string, string> = { '+': '+', '-': '\u2212', '*': '\u00D7', '/': '\u00F7' };

// -- Components --

function CalcButton(props: {
  label: string;
  onPress: () => void;
  bgColor: string;
  textColor: string;
  wide?: boolean;
}) {
  const [pressed, setPressed] = createSignal(false);
  const btnH = 80;

  // Create the Text child once. Its style and text update reactively.
  const textChild = glyphisRenderer.createComponent(Text, {
    get style(): Style {
      const label = props.label;
      return {
        color: props.textColor,
        fontSize: label === '+/-' ? 24 : (label.length === 1 ? 32 : 24),
        fontWeight: '400',
        fontFamily: 'system-ui',
        textAlign: props.wide ? 'left' : 'center',
      };
    },
    get children() { return props.label; },
  });

  return glyphisRenderer.createComponent(View, {
    onPressIn: () => setPressed(true),
    onPressOut: () => setPressed(false),
    onPress: props.onPress,
    get style(): Style {
      return {
        width: props.wide ? 170 : 80,
        height: btnH,
        borderRadius: btnH / 2,
        backgroundColor: props.bgColor,
        justifyContent: 'center',
        alignItems: props.wide ? 'flex-start' : 'center',
        paddingLeft: props.wide ? 32 : 0,
        opacity: pressed() ? 0.6 : 1,
      };
    },
    children: textChild,
  });
}

function Calculator() {
  const [display, setDisplay] = createSignal('0');
  const [prevValue, setPrevValue] = createSignal<number | null>(null);
  const [operation, setOperation] = createSignal<string | null>(null);
  const [waitingForOperand, setWaiting] = createSignal(false);
  const [activeOp, setActiveOp] = createSignal<string | null>(null);
  const [expression, setExpression] = createSignal('');

  const displayText = createMemo(() => formatDisplay(display()));
  const fontSize = createMemo(() => displayFontSize(displayText()));
  const clearLabel = createMemo(() =>
    display() === '0' && prevValue() === null && operation() === null ? 'AC' : 'C'
  );

  function calc(prev: number, op: string, cur: number): number {
    if (op === '+') return prev + cur;
    if (op === '-') return prev - cur;
    if (op === '*') return prev * cur;
    if (op === '/') return cur === 0 ? NaN : prev / cur;
    return cur;
  }

  function handleDigit(d: string) {
    if (expression().endsWith('=')) setExpression('');
    if (waitingForOperand()) {
      setDisplay(d); setWaiting(false); setActiveOp(null);
    } else {
      if (display().replace(/[.\-]/g, '').length >= 9 && d !== '.') return;
      setDisplay(display() === '0' ? d : display() + d);
    }
  }

  function handleDecimal() {
    if (expression().endsWith('=')) setExpression('');
    if (waitingForOperand()) { setDisplay('0.'); setWaiting(false); setActiveOp(null); }
    else if (!display().includes('.')) setDisplay(display() + '.');
  }

  function handleOperator(op: string) {
    const cur = parseFloat(display());
    const sym = OP_SYM[op] || op;
    if (expression().endsWith('=')) setExpression(formatDisplay(display()) + ' ' + sym + ' ');
    else if (waitingForOperand() && operation()) setExpression(p => p.replace(/\S+\s*$/, sym + ' '));
    else setExpression(p => p + formatDisplay(display()) + ' ' + sym + ' ');

    if (prevValue() !== null && operation() && !waitingForOperand()) {
      const result = calc(prevValue()!, operation()!, cur);
      if (isNaN(result) || !isFinite(result)) {
        setDisplay('Error'); setPrevValue(null); setOperation(null);
        setWaiting(true); setActiveOp(null); setExpression(''); return;
      }
      setDisplay(formatResult(result)); setPrevValue(result);
    } else { setPrevValue(cur); }

    setOperation(op); setWaiting(true); setActiveOp(op);
  }

  function handleEquals() {
    const cur = parseFloat(display());
    if (prevValue() !== null && operation()) {
      const result = calc(prevValue()!, operation()!, cur);
      setExpression(p => p + formatDisplay(display()) + ' =');
      setDisplay(isNaN(result) || !isFinite(result) ? 'Error' : formatResult(result));
      setPrevValue(null); setOperation(null);
    }
    setWaiting(true); setActiveOp(null);
  }

  function handleClear() {
    if ((display() === '0' && prevValue() === null && operation() === null) || display() === 'Error') {
      setDisplay('0'); setPrevValue(null); setOperation(null);
      setWaiting(false); setActiveOp(null); setExpression('');
    } else { setDisplay('0'); }
  }

  function handleToggleSign() {
    if (display() === '0' || display() === 'Error') return;
    setDisplay(display().startsWith('-') ? display().slice(1) : '-' + display());
  }

  function handlePercent() {
    const v = parseFloat(display());
    if (!isNaN(v)) { setDisplay(formatResult(v / 100)); setWaiting(false); }
  }

  const F_BG = '#A5A5A5', F_FG = '#000000';
  const N_BG = '#333333', N_FG = '#FFFFFF';

  // Build static component tree. Reactive values use getters.
  return glyphisRenderer.createComponent(View, {
    style: { flex: 1, backgroundColor: '#000', justifyContent: 'flex-end' as const, paddingBottom: 32, paddingHorizontal: 16 },
    children: [
      // Display
      glyphisRenderer.createComponent(View, {
        style: { paddingRight: 24, paddingBottom: 16, alignItems: 'flex-end' as const, justifyContent: 'flex-end' as const, minHeight: 150 },
        children: [
          glyphisRenderer.createComponent(Text, {
            style: { color: '#8E8E93', fontSize: 24, fontWeight: '300', fontFamily: 'system-ui', textAlign: 'right' as const, minHeight: 30 } as Style,
            get children() { return expression() || ' '; },
          }),
          glyphisRenderer.createComponent(Text, {
            get style(): Style { return { color: '#FFF', fontSize: fontSize(), fontWeight: '300', fontFamily: 'system-ui', textAlign: 'right' as const }; },
            get children() { return displayText(); },
          }),
        ],
      }),

      // Row 1
      glyphisRenderer.createComponent(View, {
        style: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 12 },
        children: [
          glyphisRenderer.createComponent(CalcButton, { get label() { return clearLabel(); }, onPress: handleClear, bgColor: F_BG, textColor: F_FG }),
          glyphisRenderer.createComponent(CalcButton, { label: '+/-', onPress: handleToggleSign, bgColor: F_BG, textColor: F_FG }),
          glyphisRenderer.createComponent(CalcButton, { label: '%', onPress: handlePercent, bgColor: F_BG, textColor: F_FG }),
          glyphisRenderer.createComponent(CalcButton, { label: '\u00F7', onPress: () => handleOperator('/'), get bgColor() { return activeOp() === '/' ? '#FFF' : '#FF9500'; }, get textColor() { return activeOp() === '/' ? '#FF9500' : '#FFF'; } }),
        ],
      }),

      // Row 2
      glyphisRenderer.createComponent(View, {
        style: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 12 },
        children: [
          glyphisRenderer.createComponent(CalcButton, { label: '7', onPress: () => handleDigit('7'), bgColor: N_BG, textColor: N_FG }),
          glyphisRenderer.createComponent(CalcButton, { label: '8', onPress: () => handleDigit('8'), bgColor: N_BG, textColor: N_FG }),
          glyphisRenderer.createComponent(CalcButton, { label: '9', onPress: () => handleDigit('9'), bgColor: N_BG, textColor: N_FG }),
          glyphisRenderer.createComponent(CalcButton, { label: '\u00D7', onPress: () => handleOperator('*'), get bgColor() { return activeOp() === '*' ? '#FFF' : '#FF9500'; }, get textColor() { return activeOp() === '*' ? '#FF9500' : '#FFF'; } }),
        ],
      }),

      // Row 3
      glyphisRenderer.createComponent(View, {
        style: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 12 },
        children: [
          glyphisRenderer.createComponent(CalcButton, { label: '4', onPress: () => handleDigit('4'), bgColor: N_BG, textColor: N_FG }),
          glyphisRenderer.createComponent(CalcButton, { label: '5', onPress: () => handleDigit('5'), bgColor: N_BG, textColor: N_FG }),
          glyphisRenderer.createComponent(CalcButton, { label: '6', onPress: () => handleDigit('6'), bgColor: N_BG, textColor: N_FG }),
          glyphisRenderer.createComponent(CalcButton, { label: '\u2212', onPress: () => handleOperator('-'), get bgColor() { return activeOp() === '-' ? '#FFF' : '#FF9500'; }, get textColor() { return activeOp() === '-' ? '#FF9500' : '#FFF'; } }),
        ],
      }),

      // Row 4
      glyphisRenderer.createComponent(View, {
        style: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, marginBottom: 12 },
        children: [
          glyphisRenderer.createComponent(CalcButton, { label: '1', onPress: () => handleDigit('1'), bgColor: N_BG, textColor: N_FG }),
          glyphisRenderer.createComponent(CalcButton, { label: '2', onPress: () => handleDigit('2'), bgColor: N_BG, textColor: N_FG }),
          glyphisRenderer.createComponent(CalcButton, { label: '3', onPress: () => handleDigit('3'), bgColor: N_BG, textColor: N_FG }),
          glyphisRenderer.createComponent(CalcButton, { label: '+', onPress: () => handleOperator('+'), get bgColor() { return activeOp() === '+' ? '#FFF' : '#FF9500'; }, get textColor() { return activeOp() === '+' ? '#FF9500' : '#FFF'; } }),
        ],
      }),

      // Row 5
      glyphisRenderer.createComponent(View, {
        style: { flexDirection: 'row' as const, justifyContent: 'space-between' as const },
        children: [
          glyphisRenderer.createComponent(CalcButton, { label: '0', onPress: () => handleDigit('0'), bgColor: N_BG, textColor: N_FG, wide: true }),
          glyphisRenderer.createComponent(CalcButton, { label: '.', onPress: handleDecimal, bgColor: N_BG, textColor: N_FG }),
          glyphisRenderer.createComponent(CalcButton, { label: '=', onPress: handleEquals, bgColor: '#FF9500', textColor: '#FFF' }),
        ],
      }),
    ],
  });
}

function App() {
  return glyphisRenderer.createComponent(View, {
    style: { flex: 1, backgroundColor: '#000' },
    get children() { return glyphisRenderer.createComponent(Calculator, {}); },
  });
}

// -- Bootstrap --

const canvas = document.getElementById('glyphis-root') as HTMLCanvasElement;
if (canvas) {
  const platform = createWebPlatform(canvas);
  render(() => glyphisRenderer.createComponent(App, {}), platform);
}
