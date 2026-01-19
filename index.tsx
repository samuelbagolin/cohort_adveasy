
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Não foi possível encontrar o elemento root.");
}

const root = ReactDOM.createRoot(rootElement);

// Captura de erro simples para debugging na Vercel
window.onerror = (msg, url, lineNo, columnNo, error) => {
  console.error('Erro Global:', msg, error);
  return false;
};

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
