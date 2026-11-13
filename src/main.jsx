import { render } from 'preact';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import './styles.css';
import { App } from './app.jsx';

render(<App />, document.getElementById('app'));

// Offline support and "Add to Home Screen". Skipped in dev so stale caches never confuse testing.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
