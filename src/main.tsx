import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './styles/academio-profile.css'
import './styles/prints.css'
import './styles/finance-income.css'
import './styles/platform-admin.css'
import './styles/announcements.css'
import './styles/attendance.css'
import './styles/photos.css'
import './styles/calendar.css'
import './styles/parents.css'
import './styles/schedule.css'
import './styles/warehouse.css'
import './styles/settings.css'
import './styles/partners.css'
import './styles/staff.css'
import './styles/athlete-portal.css'
import './styles/coach-portal.css'
/* Theme overrides last so appearance contrast wins over feature CSS */
import './styles/appearance-navy-amber.css'
import './styles/appearance-ocean-slate.css'
import './styles/appearance-midnight-ice.css'
import './styles/appearance-indigo-steel.css'
import './styles/appearance-login-split.css'
import { migratePlaintextPasswords } from './auth/auth'
import { startBackupScheduleRunner } from './data/backupScheduleRunner'
import { startAppearanceTheme } from './platform/platformConfig'
import { startDocumentBranding } from './utils/documentBranding'

startAppearanceTheme()
startDocumentBranding()
startBackupScheduleRunner()
void migratePlaintextPasswords()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
