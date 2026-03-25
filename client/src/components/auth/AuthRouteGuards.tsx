import { Navigate, Outlet } from "react-router";
import { getStoredAuthSession, isAdminRole } from "../../lib/auth";

export function RequireAuth() {
  const authSession = getStoredAuthSession();

  return authSession ? <Outlet /> : <Navigate to="/signin" replace />;
}

export function RedirectAuthenticatedUser() {
  const authSession = getStoredAuthSession();

  return authSession ? <Navigate to="/" replace /> : <Outlet />;
}

export function RequireAdmin() {
  const authSession = getStoredAuthSession();

  if (!authSession) {
    return <Navigate to="/signin" replace />;
  }

  return isAdminRole(authSession.role) ? <Outlet /> : <Navigate to="/" replace />;
}
