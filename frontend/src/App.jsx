import { useEffect, useState } from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';

import DashboardView from './views/DashboardView.jsx';
import EventsView from './views/EventsView.jsx';
import RegisterView from './views/RegisterView.jsx';
import PaymentsView from './views/PaymentsView.jsx';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/events', label: 'Eventos' },
  { to: '/register', label: 'Inscripciones' },
  { to: '/payments', label: 'Control de pagos' },
];

/**
 * Toggle claro/oscuro. La preferencia se guarda en localStorage;
 * sin preferencia guardada sigue al sistema (prefers-color-scheme).
 */
function ThemeToggle() {
  const [dark, setDark] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <button
      type="button"
      onClick={() => setDark((d) => !d)}
      aria-label={dark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className="rounded-lg border border-slate-200 bg-white/60 p-2 text-slate-600 shadow-sm transition hover:bg-slate-100 hover:text-slate-900"
    >
      {dark ? (
        /* Sol: modo claro */
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="4" />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4"
          />
        </svg>
      ) : (
        /* Luna: modo oscuro */
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"
          />
        </svg>
      )}
    </button>
  );
}

/** Layout principal + enrutado de la SPA. */
export default function App() {
  return (
    <div className="min-h-screen">
      {/* Barra superior con navegacion (responsive) */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-lg font-bold text-[#fff] shadow">
              $
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">Pagos en Cuotas</h1>
              <p className="text-xs leading-tight text-slate-400">Gestion de eventos</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <nav className="flex gap-1 overflow-x-auto">
              {NAV_ITEMS.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition ${
                      isActive
                        ? 'bg-teal-600 text-[#fff] shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardView />} />
          <Route path="/events" element={<EventsView />} />
          <Route path="/register" element={<RegisterView />} />
          <Route path="/payments" element={<PaymentsView />} />
          <Route
            path="*"
            element={<p className="text-center text-slate-500">Pagina no encontrada</p>}
          />
        </Routes>
      </main>
    </div>
  );
}
