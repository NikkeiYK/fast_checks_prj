import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loggedIn } = useAuth();
  const location = useLocation();

  if (!loggedIn) {
    // Сохраняем куда хотел попасть, чтобы вернуться после входа
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}