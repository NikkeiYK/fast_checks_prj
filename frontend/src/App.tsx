import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import OtipbModule from "./modules/otipb/OtipbModule";
import AuditForm from "./modules/otipb/components/AuditForm";
import NoCheckedList from "./modules/otipb/components/NoCheckedTab";
import LoginForm from "./layouts/Auth";
import ProtectedRoute from "./ProtectedRoute";
import WelcomePage from "./layouts/WelcomePage";
import ClimateMain from "./modules/lab/ClimateMain";
import CenterDetailPage from "./modules/lab/CenterDetailPage";
import QuarterlyReport from "./modules/otipb/components/QuarterlyReport";

// ← Новый импорт для мониторинга
import { MonitoringDashboard } from "./modules/monitoring/Dashboard";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginForm />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<WelcomePage />} />
          
          {/* Группа маршрутов для ОТиПБ */}
          <Route path="otipb" element={<OtipbModule />}>
            <Route index element={<Navigate to="audit" replace />} />
            <Route path="main" element={<QuarterlyReport/>} />
            <Route path="audit" element={<AuditForm />} />
            <Route path="no-checked-list" element={<NoCheckedList />} />
          </Route>

          {/* Группа маршрутов для Лаборатории/Климата */}
          <Route path="lab/booking" element={<Outlet />}>
            <Route index element={<ClimateMain />} />
            <Route path="centers/:centerId" element={<CenterDetailPage />} />
          </Route>

          {/* ← Группа маршрутов для Мониторинга Росстандарта */}
          <Route path="monitoring" element={<Outlet />}>
            <Route index element={<MonitoringDashboard />} />
            {/* Можно добавить позже: */}
            {/* <Route path="gost/:id" element={<GostDetailPage />} /> */}
            {/* <Route path="sp/:id" element={<SpDetailPage />} /> */}
          </Route>
        </Route>
        
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;