import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

const LINKS = [
  { to: '/', label: 'Dashboard', icon: '▣' },
  { to: '/assets', label: 'Assets', icon: '▤' },
  { to: '/inventory', label: 'Inventory', icon: '▦' },
  { to: '/customers', label: 'Customers', icon: '☺' },
  { to: '/jobs', label: 'Jobs / Planner', icon: '☰' },
  { to: '/calendar', label: 'Calendar', icon: '▦' },
  { to: '/maintenance', label: 'Maintenance', icon: '⚙' },
  { to: '/reports', label: 'Reports', icon: '▤' },
  { to: '/settings', label: 'Settings', icon: '○' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <h1>Asset Manager</h1>
          <p>Midlands Highways Plant</p>
        </div>
        <nav className="sidebar-nav">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <span className="nav-icon">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">UK contractor ops · MVP</div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">Plant &amp; Asset Control</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div className="theme-toggle">
              <span>Light</span>
              <button
                type="button"
                className="theme-switch"
                aria-label="Toggle colour theme"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
                onClick={toggle}
              />
              <span>Dark</span>
            </div>
            <div className="user-menu">
              <span>{user?.name || user?.email}</span>
              <button
                className="btn btn-sm"
                type="button"
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
              >
                Log out
              </button>
            </div>
          </div>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
