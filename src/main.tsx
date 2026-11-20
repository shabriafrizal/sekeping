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
import { initRust } from './lib/rust';

function render() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <Theme theme={sekepingTheme}>
        <StoreProvider>
          <App />
        </StoreProvider>
      </Theme>
    </React.StrictMode>,
  );
}

async function start() {
  try {
    await initRust();
    render();
  } catch (error) {
    console.error('Sekeping could not load its Rust core', error);
    const root = document.getElementById('root');
    if (root) {
      root.replaceChildren();
      const main = document.createElement('main');
      main.style.cssText = 'font:16px/1.5 system-ui;padding:2rem;max-width:42rem;margin:auto';
      const title = document.createElement('h1');
      title.style.fontSize = '1.25rem';
      title.textContent = 'Sekeping could not start';
      const body = document.createElement('p');
      body.textContent =
        'The local engine did not load. Refresh the page, or open the app in a newer browser.';
      main.append(title, body);
      root.append(main);
    }
  }
}

void start();
