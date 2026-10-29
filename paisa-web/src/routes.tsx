import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  Navigate,
} from "react-router-dom";

import AppShell from "./components/layout/AppShell";
import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./features/auth/LoginPage";
import RegisterPage from "./features/auth/Registerpage";
import DashboardPage from "./features/dashboard/DashboardPage";
import AskPage from "./features/ask/AskPage";
import PayeesPage from "./features/payees/PayeesPage";
import PeoplePage from "./features/people/PeoplePage";
// import AskPage from "./features/ask/AskPage";
// import PayeesPage from "./features/payees/PayeesPage";
// import PeoplePage from "./features/people/PeoplePage";

export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      {/* Public — outside the guard, or logging in loops forever */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Guard, then shell, then pages */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/ask" element={<AskPage />} />
          <Route path="/payees" element={<PayeesPage />} />
          <Route path="/people" element={<PeoplePage />} />
        </Route>
      </Route>

      {/* Catch-all OUTSIDE the guard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Route>
  )
);