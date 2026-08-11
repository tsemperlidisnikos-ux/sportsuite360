import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/academio-profile.css';
import './styles/prints.css';
import './styles/finance-income.css';
import './styles/platform-admin.css';
import './styles/announcements.css';
import { startDocumentBranding } from './utils/documentBranding';

startDocumentBranding();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
