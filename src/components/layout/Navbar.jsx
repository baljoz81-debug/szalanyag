// Navigációs sáv — sticky, aktív link accent színnel, 3 NavLink + projekt mentés/betöltés
import { NavLink } from 'react-router-dom';
import ProjectIO from './ProjectIO';

function Navbar() {
  // NavLink className helper: aktív = narancs, inaktív = szürke
  const getLinkClass = ({ isActive }) =>
    isActive
      ? 'text-accent font-semibold border-b-2 border-accent pb-1 transition-colors'
      : 'text-text-secondary hover:text-text-primary transition-colors';

  return (
    <nav className="sticky top-0 z-50 h-14 bg-panel border-b border-border-subtle flex items-center px-4 md:px-8 gap-6">
      {/* App neve — bal oldalt */}
      <span className="font-heading text-accent font-bold text-lg mr-auto tracking-tight">
        SZÁLANYAG SZÁMÍTÓ
      </span>

      {/* Navigációs linkek */}
      <div className="flex items-center gap-6">
        <NavLink to="/" end className={getLinkClass}>
          Kalkuláció
        </NavLink>
        <NavLink to="/szabott" className={getLinkClass}>
          Szabott termékek
        </NavLink>
        <NavLink to="/beallitasok" className={getLinkClass}>
          Beállítások
        </NavLink>
      </div>

      {/* Projekt mentés / betöltés — jobb oldalt */}
      <ProjectIO />
    </nav>
  );
}

export default Navbar;
