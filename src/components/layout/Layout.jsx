// Layout wrapper — Navbar + Outlet (oldaltartalom)
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

function Layout() {
  return (
    <div className="min-h-screen bg-app-bg">
      <Navbar />
      <Outlet />
    </div>
  );
}

export default Layout;
