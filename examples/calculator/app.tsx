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

  // Determine if display shows "AC" or "C"
  const currentClearLabel = useMemo(() => {
    return display === '0' && previousValue === null && operation === null ? 'AC' : 'C';
  }, [display, previousValue, operation]);

  const handleDigit = useCallback((digit: string) => {
    if (expression.endsWith('=')) {
      setExpression('');
    }
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
      setActiveOperator(null);
    } else {
      // Limit display length (9 digits max, not counting minus or decimal)
      const rawLen = display.replace(/[.\-]/g, '').length;
      if (rawLen >= 9 && digit !== '.') return;
      setDisplay(display === '0' ? digit : display + digit);
    }
    setClearLabel('C');
  }, [display, waitingForOperand, expression]);

  const handleDecimal = useCallback(() => {
    if (expression.endsWith('=')) {
      setExpression('');
    }
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      setActiveOperator(null);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
    setClearLabel('C');
  }, [display, waitingForOperand, expression]);

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
    const currentValue = parseFloat(display);
    const opSymbol = opSymbolMap[op] || op;

    if (expression.endsWith('=')) {
      // Starting a new chain from a previous result
      setExpression(formatDisplay(display) + ' ' + opSymbol + ' ');
    } else if (waitingForOperand && operation) {
      // Changing operator without entering a new number: replace the last operator
      setExpression(prev => prev.replace(/\S+\s*$/, opSymbol + ' '));
    } else {
      // Append current value and operator
      setExpression(prev => prev + formatDisplay(display) + ' ' + opSymbol + ' ');
    }

    if (previousValue !== null && operation && !waitingForOperand) {
      // Chained operation: compute previous result first
      const result = performOperation(previousValue, operation, currentValue);
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
  }, [display, previousValue, operation, waitingForOperand, performOperation, expression]);

  const handleEquals = useCallback(() => {
    const currentValue = parseFloat(display);

    if (previousValue !== null && operation) {
      const result = performOperation(previousValue, operation, currentValue);
      setExpression(prev => prev + formatDisplay(display) + ' =');
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
  }, [display, previousValue, operation, performOperation, expression]);

  const handleClear = useCallback(() => {
    if (currentClearLabel === 'AC' || display === 'Error') {
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
  }, [currentClearLabel, display]);

  const handleToggleSign = useCallback(() => {
    if (display === '0' || display === 'Error') return;
    if (display.startsWith('-')) {
      setDisplay(display.slice(1));
    } else {
      setDisplay('-' + display);
    }
  }, [display]);

  const handlePercent = useCallback(() => {
    const value = parseFloat(display);
    if (isNaN(value)) return;
    const result = value / 100;
    setDisplay(formatResult(result));
    setWaitingForOperand(false);
  }, [display]);

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
