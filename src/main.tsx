import React from 'react';
import ReactDOM from 'react-dom/client';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import './fonts.css';
import './app.css';
import App from './App';
import { Theme } from '@astryxdesign/core/theme';
import { sekepingTheme } from './theme';
import { StoreProvider } from './lib/store';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Theme theme={sekepingTheme}>
      <StoreProvider>
        <App />
      </StoreProvider>
    </Theme>
  </React.StrictMode>,
);
