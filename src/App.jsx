// P1: Routes + Layout wrapper — a DemoCard helyett teljes routing
import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import CalculationPage from './pages/CalculationPage';
import CutProductsPage from './pages/CutProductsPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CalculationPage />} />
        <Route path="szabott" element={<CutProductsPage />} />
        <Route path="beallitasok" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
