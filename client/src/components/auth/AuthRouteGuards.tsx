import { Navigate, Outlet } from "react-router";
import LoadingIndicator from "../common/LoadingIndicator";
import { isAdminRole } from "../../lib/auth";
import { useAuthSession } from "../../context/AuthSessionContext";

const AuthGuardLoadingState = () => (
  <div className="flex min-h-screen items-center justify-center px-6">
    <LoadingIndicator
      layout="stacked"
      size="lg"
      label="Restoring your session"
      description="Please wait while your secure sign-in state is verified."
    />
  </div>
);

export function RequireAuth() {
  const { authSession, isAuthReady } = useAuthSession();

  if (!isAuthReady) {
    return <AuthGuardLoadingState />;
  }
  return authSession ? <Outlet /> : <Navigate to="/signin" replace />;
}

export function RedirectAuthenticatedUser() {
  const { authSession, isAuthReady } = useAuthSession();

  if (!isAuthReady) {
    return <AuthGuardLoadingState />;
  }
  return authSession ? <Navigate to="/" replace /> : <Outlet />;
}

export function RequireAdmin() {
  const { authSession, isAuthReady } = useAuthSession();

  if (!isAuthReady) {
    return <AuthGuardLoadingState />;
  }
  if (!authSession) {
    return <Navigate to="/signin" replace />;
  }

  return isAdminRole(authSession.role) ? <Outlet /> : <Navigate to="/" replace />;
}
