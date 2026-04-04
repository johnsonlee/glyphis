import React, { useState, useCallback } from 'react';
import { View, Text, Button } from '../../src/react/components';
import { render } from '../../src/react/platform-web';

interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

function TodoItem({ todo, onToggle, onDelete }: {
  todo: Todo;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return React.createElement(View, {
    style: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#E0E0E0',
      backgroundColor: '#FFFFFF',
    },
  },
    // Checkbox
    React.createElement(View, {
      onPress: onToggle,
      style: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: todo.completed ? '#4CAF50' : '#BDBDBD',
        backgroundColor: todo.completed ? '#4CAF50' : 'transparent',
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
      },
    },
      todo.completed
        ? React.createElement(Text, { style: { color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' } }, '\u2713')
        : null,
    ),
    // Text
    React.createElement(View, { style: { flex: 1 } },
      React.createElement(Text, {
        style: {
          fontSize: 16,
          color: todo.completed ? '#9E9E9E' : '#212121',
          textDecorationLine: todo.completed ? 'line-through' : 'none',
        },
      }, todo.text),
    ),
    // Delete button
    React.createElement(View, {
      onPress: onDelete,
      style: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#FFEBEE',
        justifyContent: 'center',
        alignItems: 'center',
      },
    },
      React.createElement(Text, { style: { color: '#F44336', fontSize: 16, fontWeight: 'bold' } }, '\u00d7'),
    ),
  );
}

function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([
    { id: 1, text: 'Learn Glyph', completed: false },
    { id: 2, text: 'Build an app', completed: false },
    { id: 3, text: 'Ship to production', completed: false },
  ]);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  const toggleTodo = useCallback((id: number) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  }, []);

  const deleteTodo = useCallback((id: number) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  }, []);

  const addTodo = useCallback(() => {
    const id = Date.now();
    setTodos(prev => [...prev, { id, text: `New task ${prev.length + 1}`, completed: false }]);
  }, []);

  const filteredTodos = todos.filter(t => {
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const activeCount = todos.filter(t => !t.completed).length;

  return React.createElement(View, { style: { flex: 1, backgroundColor: '#F5F5F5' } },
    // Header
    React.createElement(View, {
      style: { height: 44, backgroundColor: '#1976D2' },
    }),
    React.createElement(View, {
      style: { height: 56, backgroundColor: '#1976D2', justifyContent: 'center', alignItems: 'center' },
    },
      React.createElement(Text, { style: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' } }, 'Todo App'),
    ),

    // Stats + Add button
    React.createElement(View, {
      style: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
      },
    },
      React.createElement(Text, { style: { fontSize: 14, color: '#757575' } },
        `${activeCount} item${activeCount !== 1 ? 's' : ''} left`,
      ),
      React.createElement(Button, { title: '+ Add', onPress: addTodo, style: { paddingHorizontal: 20 } }),
    ),

    // Filter buttons
    React.createElement(View, {
      style: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
    },
      React.createElement(Button, {
        title: 'All',
        onPress: () => setFilter('all'),
        color: filter === 'all' ? '#1976D2' : '#BDBDBD',
        style: { paddingHorizontal: 16, paddingVertical: 6 },
      }),
      React.createElement(Button, {
        title: 'Active',
        onPress: () => setFilter('active'),
        color: filter === 'active' ? '#1976D2' : '#BDBDBD',
        style: { paddingHorizontal: 16, paddingVertical: 6 },
      }),
      React.createElement(Button, {
        title: 'Done',
        onPress: () => setFilter('completed'),
        color: filter === 'completed' ? '#1976D2' : '#BDBDBD',
        style: { paddingHorizontal: 16, paddingVertical: 6 },
      }),
    ),

    // Todo list
    React.createElement(View, { style: { flex: 1 } },
      filteredTodos.length === 0
        ? React.createElement(View, {
            style: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
          },
            React.createElement(Text, { style: { fontSize: 16, color: '#9E9E9E' } },
              filter === 'all' ? 'No tasks yet' : filter === 'active' ? 'All done!' : 'No completed tasks',
            ),
          )
        : filteredTodos.map(todo =>
            React.createElement(TodoItem, {
              key: todo.id,
              todo,
              onToggle: () => toggleTodo(todo.id),
              onDelete: () => deleteTodo(todo.id),
            }),
          ),
    ),
  );
}

const canvas = document.getElementById('glyph-root') as HTMLCanvasElement;
if (canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  render(React.createElement(TodoApp, {}), canvas);
}
