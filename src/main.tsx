import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

/* PrimeReact CSS */
import 'primereact/resources/themes/lara-dark-blue/theme.css'; // Dark theme that matches Ionic
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';

/* macOS Visual Feedback Animations */
import './theme/macos-feedback.css';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);