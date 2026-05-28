import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import OtipbModule from "./modules/otipb/OtipbModule";
import AuditForm from "./modules/otipb/components/AuditForm";
import NoCheckedList from "./modules/otipb/components/NoCheckedTab";
import LoginForm from "./layouts/Auth";
import ProtectedRoute from "./ProtectedRoute";
import WelcomePage from "./layouts/WelcomePage";
import Booking from "./modules/lab/components/Booking";
import QuarterlyReport from "./modules/otipb/components/QuarterlyReport"

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
            <Route path="main" element={<QuarterlyReport/>} />
            <Route path="audit" element={<AuditForm />} />
            <Route path="no-checked-list" element={<NoCheckedList />} />
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