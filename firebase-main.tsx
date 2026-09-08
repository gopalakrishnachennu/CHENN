import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/geist';
import '@fontsource-variable/inter';
import '@fontsource-variable/source-sans-3';
import Home from './app/page';
import './app/globals.css';

const root = document.getElementById('root');

if (!root) throw new Error('ResumeOS root element is missing.');

createRoot(root).render(
  <React.StrictMode>
    <Home />
  </React.StrictMode>,
);
