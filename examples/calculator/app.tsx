import React, { useState, useCallback, useMemo } from 'react';
import { View, Text } from '../../src/react/components';
import { render } from '../../src/react/platform-web';

// -- Number formatting ----------------------------------------------------------

function formatDisplay(value: string): string {
  // Handle special values
  if (value === 'Error') return 'Error';

  const isNegative = value.startsWith('-');
  const abs = isNegative ? value.slice(1) : value;

  // If it contains a decimal point, format the integer part only
  if (abs.includes('.')) {
    const [intPart, decPart] = abs.split('.');
    const formattedInt = addCommas(intPart);
    const result = formattedInt + '.' + decPart;
    return isNegative ? '-' + result : result;
  }

  const formatted = addCommas(abs);
  return isNegative ? '-' + formatted : formatted;
}

function addCommas(intStr: string): string {
  if (intStr.length <= 3) return intStr;
  const reversed = intStr.split('').reverse();
  const chunks: string[] = [];
  for (let i = 0; i < reversed.length; i += 3) {
    chunks.push(reversed.slice(i, i + 3).reverse().join(''));
  }
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

// -- CalcButton component -------------------------------------------------------

interface CalcButtonProps {
  label: string;
  onPress: () => void;
  bgColor: string;
  textColor: string;
  wide?: boolean;
}

function CalcButton(props: CalcButtonProps) {
  const { label, onPress, bgColor, textColor, wide } = props;
  const [pressed, setPressed] = useState(false);

  const btnHeight = 80;
  const btnWidth = wide ? 170 : 80;
  const fontSize = label === '+/-' ? 24 : (label.length === 1 ? 32 : 24);

  return React.createElement(View, {
    onPressIn: () => setPressed(true),
    onPressOut: () => setPressed(false),
    onPress: onPress,
    style: {
      width: btnWidth,
      height: btnHeight,
      borderRadius: btnHeight / 2,
      backgroundColor: bgColor,
      justifyContent: 'center',
      alignItems: wide ? 'flex-start' : 'center',
      paddingLeft: wide ? 32 : 0,
      opacity: pressed ? 0.6 : 1,
    },
  },
    React.createElement(Text, {
      style: {
        color: textColor,
        fontSize: fontSize,
        fontWeight: '400',
        fontFamily: 'system-ui',
        textAlign: wide ? 'left' : 'center',
      },
    }, label),
  );
}

// -- Calculator component -------------------------------------------------------

function Calculator() {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [activeOperator, setActiveOperator] = useState<string | null>(null);
  const [clearLabel, setClearLabel] = useState('AC');
  const [expression, setExpression] = useState('');

  // Refs that always point to the latest state — avoids stale closures on iOS
  // where queueMicrotask is polyfilled as a macrotask.
  const displayRef = React.useRef(display);
  displayRef.current = display;

  const previousValueRef = React.useRef(previousValue);
  previousValueRef.current = previousValue;

  const operationRef = React.useRef(operation);
  operationRef.current = operation;

  const waitingForOperandRef = React.useRef(waitingForOperand);
  waitingForOperandRef.current = waitingForOperand;

  const expressionRef = React.useRef(expression);
  expressionRef.current = expression;

  const activeOperatorRef = React.useRef(activeOperator);
  activeOperatorRef.current = activeOperator;

  // Determine if display shows "AC" or "C"
  const currentClearLabel = useMemo(() => {
    return display === '0' && previousValue === null && operation === null ? 'AC' : 'C';
  }, [display, previousValue, operation]);

  const handleDigit = useCallback((digit: string) => {
    if (expressionRef.current.endsWith('=')) {
      setExpression('');
    }
    if (waitingForOperandRef.current) {
      setDisplay(digit);
      setWaitingForOperand(false);
      setActiveOperator(null);
    } else {
      // Limit display length (9 digits max, not counting minus or decimal)
      const rawLen = displayRef.current.replace(/[.\-]/g, '').length;
      if (rawLen >= 9 && digit !== '.') return;
      setDisplay(displayRef.current === '0' ? digit : displayRef.current + digit);
    }
    setClearLabel('C');
  }, []);

  const handleDecimal = useCallback(() => {
    if (expressionRef.current.endsWith('=')) {
      setExpression('');
    }
    if (waitingForOperandRef.current) {
      setDisplay('0.');
      setWaitingForOperand(false);
      setActiveOperator(null);
    } else if (!displayRef.current.includes('.')) {
      setDisplay(displayRef.current + '.');
    }
    setClearLabel('C');
  }, []);

  const performOperation = useCallback((prev: number, op: string, current: number): number => {
    switch (op) {
      case '+': return prev + current;
      case '-': return prev - current;
      case '*': return prev * current;
      case '/': return current === 0 ? NaN : prev / current;
      default: return current;
    }
  }, []);

  const opSymbolMap: Record<string, string> = { '+': '+', '-': '\u2212', '*': '\u00D7', '/': '\u00F7' };

  const handleOperator = useCallback((op: string) => {
    const currentValue = parseFloat(displayRef.current);
    const opSymbol = opSymbolMap[op] || op;

    if (expressionRef.current.endsWith('=')) {
      // Starting a new chain from a previous result
      setExpression(formatDisplay(displayRef.current) + ' ' + opSymbol + ' ');
    } else if (waitingForOperandRef.current && operationRef.current) {
      // Changing operator without entering a new number: replace the last operator
      setExpression(prev => prev.replace(/\S+\s*$/, opSymbol + ' '));
    } else {
      // Append current value and operator
      setExpression(prev => prev + formatDisplay(displayRef.current) + ' ' + opSymbol + ' ');
    }

    if (previousValueRef.current !== null && operationRef.current && !waitingForOperandRef.current) {
      // Chained operation: compute previous result first
      const result = performOperation(previousValueRef.current, operationRef.current, currentValue);
      if (isNaN(result) || !isFinite(result)) {
        setDisplay('Error');
        setPreviousValue(null);
        setOperation(null);
        setWaitingForOperand(true);
        setActiveOperator(null);
        setExpression('');
        return;
      }
      const resultStr = formatResult(result);
      setDisplay(resultStr);
      setPreviousValue(result);
    } else {
      setPreviousValue(currentValue);
    }

    setOperation(op);
    setWaitingForOperand(true);
    setActiveOperator(op);
  }, [performOperation]);

  const handleEquals = useCallback(() => {
    const currentValue = parseFloat(displayRef.current);

    if (previousValueRef.current !== null && operationRef.current) {
      const result = performOperation(previousValueRef.current, operationRef.current, currentValue);
      setExpression(prev => prev + formatDisplay(displayRef.current) + ' =');
      if (isNaN(result) || !isFinite(result)) {
        setDisplay('Error');
      } else {
        setDisplay(formatResult(result));
      }
      setPreviousValue(null);
      setOperation(null);
    }

    setWaitingForOperand(true);
    setActiveOperator(null);
  }, [performOperation]);

  const handleClear = useCallback(() => {
    const d = displayRef.current;
    const isAC = d === '0' && previousValueRef.current === null && operationRef.current === null;
    if (isAC || d === 'Error') {
      // Full clear
      setDisplay('0');
      setPreviousValue(null);
      setOperation(null);
      setWaitingForOperand(false);
      setActiveOperator(null);
      setExpression('');
    } else {
      // Clear entry
      setDisplay('0');
    }
    setClearLabel('AC');
  }, []);

  const handleToggleSign = useCallback(() => {
    const d = displayRef.current;
    if (d === '0' || d === 'Error') return;
    if (d.startsWith('-')) {
      setDisplay(d.slice(1));
    } else {
      setDisplay('-' + d);
    }
  }, []);

  const handlePercent = useCallback(() => {
    const value = parseFloat(displayRef.current);
    if (isNaN(value)) return;
    const result = value / 100;
    setDisplay(formatResult(result));
    setWaitingForOperand(false);
  }, []);

  // Format a numeric result to fit the display
  function formatResult(value: number): string {
    if (isNaN(value) || !isFinite(value)) return 'Error';

    // Check if result is too large
    if (Math.abs(value) >= 1e15) {
      return value.toExponential(5);
    }

    // Convert to string, limit precision
    let str = String(value);

    // Handle floating point precision issues
    // Limit to at most 9 significant digits
    if (str.includes('.')) {
      const parsed = parseFloat(value.toPrecision(9));
      str = String(parsed);
    }

    // If the string is too long (more than 9 digits), use toPrecision
    const digitCount = str.replace(/[.\-]/g, '').length;
    if (digitCount > 9) {
      str = String(parseFloat(value.toPrecision(9)));
    }

    return str;
  }

  // Formatted display text
  const displayText = useMemo(() => {
    return formatDisplay(display);
  }, [display]);

  const fontSize = useMemo(() => {
    return displayFontSize(displayText);
  }, [displayText]);

  // Operator button helper: determines colors based on active state
  function opBg(op: string): string {
    return activeOperator === op ? '#FFFFFF' : '#FF9500';
  }
  function opFg(op: string): string {
    return activeOperator === op ? '#FF9500' : '#FFFFFF';
  }

  // Color constants
  const FUNC_BG = '#A5A5A5';
  const FUNC_FG = '#000000';
  const NUM_BG = '#333333';
  const NUM_FG = '#FFFFFF';

  return React.createElement(View, {
    style: {
      flex: 1,
      backgroundColor: '#000000',
      justifyContent: 'flex-end',
      paddingBottom: 32,
      paddingHorizontal: 16,
    },
  },
    // Display area
    React.createElement(View, {
      style: {
        paddingRight: 24,
        paddingBottom: 16,
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        minHeight: 150,
      },
    },
      // Expression line (smaller, gray)
      React.createElement(Text, {
        style: {
          color: '#8E8E93',
          fontSize: 24,
          fontWeight: '300',
          fontFamily: 'system-ui',
          textAlign: 'right',
          minHeight: 30,
        },
      }, expression || ' '),
      // Current value (large, white)
      React.createElement(Text, {
        style: {
          color: '#FFFFFF',
          fontSize: fontSize,
          fontWeight: '300',
          fontFamily: 'system-ui',
          textAlign: 'right',
        },
      }, displayText),
    ),

    // Row 1: AC, +/-, %, div
    React.createElement(View, {
      style: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
      },
    },
      React.createElement(CalcButton, { label: currentClearLabel, onPress: handleClear, bgColor: FUNC_BG, textColor: FUNC_FG }),
      React.createElement(CalcButton, { label: '+/-', onPress: handleToggleSign, bgColor: FUNC_BG, textColor: FUNC_FG }),
      React.createElement(CalcButton, { label: '%', onPress: handlePercent, bgColor: FUNC_BG, textColor: FUNC_FG }),
      React.createElement(CalcButton, {
        label: '\u00F7',
        onPress: () => handleOperator('/'),
        bgColor: opBg('/'),
        textColor: opFg('/'),
      }),
    ),

    // Row 2: 7, 8, 9, mul
    React.createElement(View, {
      style: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
      },
    },
      React.createElement(CalcButton, { label: '7', onPress: () => handleDigit('7'), bgColor: NUM_BG, textColor: NUM_FG }),
      React.createElement(CalcButton, { label: '8', onPress: () => handleDigit('8'), bgColor: NUM_BG, textColor: NUM_FG }),
      React.createElement(CalcButton, { label: '9', onPress: () => handleDigit('9'), bgColor: NUM_BG, textColor: NUM_FG }),
      React.createElement(CalcButton, {
        label: '\u00D7',
        onPress: () => handleOperator('*'),
        bgColor: opBg('*'),
        textColor: opFg('*'),
      }),
    ),

    // Row 3: 4, 5, 6, sub
    React.createElement(View, {
      style: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
      },
    },
      React.createElement(CalcButton, { label: '4', onPress: () => handleDigit('4'), bgColor: NUM_BG, textColor: NUM_FG }),
      React.createElement(CalcButton, { label: '5', onPress: () => handleDigit('5'), bgColor: NUM_BG, textColor: NUM_FG }),
      React.createElement(CalcButton, { label: '6', onPress: () => handleDigit('6'), bgColor: NUM_BG, textColor: NUM_FG }),
      React.createElement(CalcButton, {
        label: '\u2212',
        onPress: () => handleOperator('-'),
        bgColor: opBg('-'),
        textColor: opFg('-'),
      }),
    ),

    // Row 4: 1, 2, 3, add
    React.createElement(View, {
      style: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
      },
    },
      React.createElement(CalcButton, { label: '1', onPress: () => handleDigit('1'), bgColor: NUM_BG, textColor: NUM_FG }),
      React.createElement(CalcButton, { label: '2', onPress: () => handleDigit('2'), bgColor: NUM_BG, textColor: NUM_FG }),
      React.createElement(CalcButton, { label: '3', onPress: () => handleDigit('3'), bgColor: NUM_BG, textColor: NUM_FG }),
      React.createElement(CalcButton, {
        label: '+',
        onPress: () => handleOperator('+'),
        bgColor: opBg('+'),
        textColor: opFg('+'),
      }),
    ),

    // Row 5: 0 (wide), ., =
    React.createElement(View, {
      style: {
        flexDirection: 'row',
        justifyContent: 'space-between',
      },
    },
      React.createElement(CalcButton, { label: '0', onPress: () => handleDigit('0'), bgColor: NUM_BG, textColor: NUM_FG, wide: true }),
      React.createElement(CalcButton, { label: '.', onPress: handleDecimal, bgColor: NUM_BG, textColor: NUM_FG }),
      React.createElement(CalcButton, { label: '=', onPress: handleEquals, bgColor: '#FF9500', textColor: '#FFFFFF' }),
    ),
  );
}

// -- App bootstrap --------------------------------------------------------------

function App() {
  return React.createElement(View, {
    style: {
      flex: 1,
      backgroundColor: '#000000',
    },
  },
    React.createElement(Calculator, {}),
  );
}

const canvas = document.getElementById('glyph-root') as HTMLCanvasElement;
if (canvas) {
  const dpr = window.devicePixelRatio || 1;
  // Set canvas to iPhone-like dimensions if container allows
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  render(React.createElement(App, {}), canvas);
}
