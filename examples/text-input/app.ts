import { render, View, Text, TextInput, Button, ScrollView, createWebPlatform, createSignal, glyphisRenderer } from '../../src';
import type { Style } from '../../src';

// -- Field component --

function LabeledField(props: {
  label: string;
  children: any;
}) {
  var labelText = glyphisRenderer.createComponent(Text, {
    style: {
      color: '#333333',
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    } as Style,
    get children() { return props.label; },
  });

  return glyphisRenderer.createComponent(View, {
    style: { marginBottom: 16 } as Style,
    children: [labelText, props.children],
  });
}

// -- Main form --

function TextInputForm() {
  var nameSignal = createSignal('');
  var getName = nameSignal[0];
  var setName = nameSignal[1];

  var emailSignal = createSignal('');
  var getEmail = emailSignal[0];
  var setEmail = emailSignal[1];

  var passwordSignal = createSignal('');
  var getPassword = passwordSignal[0];
  var setPassword = passwordSignal[1];

  var ageSignal = createSignal('');
  var getAge = ageSignal[0];
  var setAge = ageSignal[1];

  var bioSignal = createSignal('');
  var getBio = bioSignal[0];
  var setBio = bioSignal[1];

  var submittedSignal = createSignal(false);
  var getSubmitted = submittedSignal[0];
  var setSubmitted = submittedSignal[1];

  function handleSubmit() {
    setSubmitted(true);
  }

  // Title
  var title = glyphisRenderer.createComponent(Text, {
    style: {
      color: '#000000',
      fontSize: 24,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 24,
    } as Style,
    children: 'TextInput Demo',
  });

  // Regular text input
  var nameField = glyphisRenderer.createComponent(LabeledField, {
    label: 'Name',
    get children() {
      return glyphisRenderer.createComponent(TextInput, {
        get value() { return getName(); },
        onChangeText: function(text: string) { setName(text); },
        placeholder: 'Enter your name',
        style: { fontSize: 16 } as Style,
      });
    },
  });

  // Email input
  var emailField = glyphisRenderer.createComponent(LabeledField, {
    label: 'Email',
    get children() {
      return glyphisRenderer.createComponent(TextInput, {
        get value() { return getEmail(); },
        onChangeText: function(text: string) { setEmail(text); },
        placeholder: 'Enter your email',
        keyboardType: 'email-address' as const,
        style: { fontSize: 16 } as Style,
      });
    },
  });

  // Password input
  var passwordField = glyphisRenderer.createComponent(LabeledField, {
    label: 'Password',
    get children() {
      return glyphisRenderer.createComponent(TextInput, {
        get value() { return getPassword(); },
        onChangeText: function(text: string) { setPassword(text); },
        placeholder: 'Enter your password',
        secureTextEntry: true,
        style: { fontSize: 16 } as Style,
      });
    },
  });

  // Number input
  var ageField = glyphisRenderer.createComponent(LabeledField, {
    label: 'Age',
    get children() {
      return glyphisRenderer.createComponent(TextInput, {
        get value() { return getAge(); },
        onChangeText: function(text: string) { setAge(text); },
        placeholder: 'Enter your age',
        keyboardType: 'number-pad' as const,
        style: { fontSize: 16 } as Style,
      });
    },
  });

  // Multiline text area
  var bioField = glyphisRenderer.createComponent(LabeledField, {
    label: 'Bio',
    get children() {
      return glyphisRenderer.createComponent(TextInput, {
        get value() { return getBio(); },
        onChangeText: function(text: string) { setBio(text); },
        placeholder: 'Tell us about yourself...',
        multiline: true,
        style: { fontSize: 16, height: 100 } as Style,
      });
    },
  });

  // Submit button
  var submitButton = glyphisRenderer.createComponent(Button, {
    title: 'Submit',
    onPress: handleSubmit,
    color: '#4CAF50',
    style: { marginTop: 8 } as Style,
  });

  // Current values display
  var valuesDisplay = glyphisRenderer.createComponent(View, {
    style: {
      marginTop: 24,
      padding: 16,
      backgroundColor: '#F5F5F5',
      borderRadius: 8,
    } as Style,
    children: [
      glyphisRenderer.createComponent(Text, {
        style: { color: '#333333', fontSize: 16, fontWeight: '600', marginBottom: 8 } as Style,
        children: 'Current Values:',
      }),
      glyphisRenderer.createComponent(Text, {
        style: { color: '#666666', fontSize: 14, marginBottom: 4 } as Style,
        get children() { return 'Name: ' + getName(); },
      }),
      glyphisRenderer.createComponent(Text, {
        style: { color: '#666666', fontSize: 14, marginBottom: 4 } as Style,
        get children() { return 'Email: ' + getEmail(); },
      }),
      glyphisRenderer.createComponent(Text, {
        style: { color: '#666666', fontSize: 14, marginBottom: 4 } as Style,
        get children() { return 'Password: ' + (getPassword() ? '****' : ''); },
      }),
      glyphisRenderer.createComponent(Text, {
        style: { color: '#666666', fontSize: 14, marginBottom: 4 } as Style,
        get children() { return 'Age: ' + getAge(); },
      }),
      glyphisRenderer.createComponent(Text, {
        style: { color: '#666666', fontSize: 14 } as Style,
        get children() { return 'Bio: ' + getBio(); },
      }),
    ],
  });

  // Submitted message
  var submittedMessage = glyphisRenderer.createComponent(View, {
    get style() {
      return {
        marginTop: 16,
        padding: 16,
        backgroundColor: '#E8F5E9',
        borderRadius: 8,
        display: getSubmitted() ? 'flex' : 'none',
      } as Style;
    },
    children: glyphisRenderer.createComponent(Text, {
      style: { color: '#2E7D32', fontSize: 16, fontWeight: '600', textAlign: 'center' } as Style,
      children: 'Form submitted successfully!',
    }),
  });

  return glyphisRenderer.createComponent(ScrollView, {
    style: { flex: 1, backgroundColor: '#FFFFFF' } as Style,
    contentHeight: 800,
    children: glyphisRenderer.createComponent(View, {
      style: { padding: 24, paddingTop: 48 } as Style,
      children: [
        title,
        nameField,
        emailField,
        passwordField,
        ageField,
        bioField,
        submitButton,
        valuesDisplay,
        submittedMessage,
      ],
    }),
  });
}

function App() {
  return glyphisRenderer.createComponent(View, {
    style: { flex: 1, backgroundColor: '#FFFFFF' } as Style,
    get children() { return glyphisRenderer.createComponent(TextInputForm, {}); },
  });
}

// -- Bootstrap --

var canvas = document.getElementById('glyphis-root') as HTMLCanvasElement;
if (canvas) {
  var platform = createWebPlatform(canvas);
  render(function() { return glyphisRenderer.createComponent(App, {}); }, platform);
}
