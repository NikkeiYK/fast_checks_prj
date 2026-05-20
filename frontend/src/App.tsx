import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import OtipbModule from "./modules/otipb/OtipbModule";
import AuditForm from "./modules/otipb/components/AuditForm";
import History from "./modules/otipb/components/History";
import LoginForm from "./layouts/Auth";
import ProtectedRoute from "./ProtectedRoute";
import WelcomePage from "./layouts/WelcomePage";
import Booking from "./modules/lab/components/Booking";

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
          {/* Группа маршрутов для ОТиПБ с общим лейаутом (табы) */}
          <Route path="otipb" element={<OtipbModule />}>
            <Route index element={<Navigate to="audit" replace />} />
            <Route path="audit" element={<AuditForm />} />
            <Route path="history" element={<History />} />
          </Route>
          <Route path="lab/booking" element={<Booking />} />
        </Route>
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;