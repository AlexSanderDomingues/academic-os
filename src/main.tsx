import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css' // <--- ESSA LINHA É A CHAVE DA BELEZA!
// Adicione esta linha:
(window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = { isDisabled: true }; 
// Ou para uma sintaxe mais limpa (se for TypeScript e você não quiser fazer casting):
if (typeof window !== 'undefined') {
  (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = { isDisabled: true };
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
