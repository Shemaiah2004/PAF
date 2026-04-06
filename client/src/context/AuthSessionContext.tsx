import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  AUTH_CHANGE_EVENT,
  clearAuthSession,
  getStoredAuthSession,
  replaceStoredAuthSession,
  restoreAuthSessionFromServer,
  type AuthSession,
} from "../lib/auth";

type AuthSessionContextValue = {
  authSession: AuthSession | null;
  isAuthReady: boolean;
};

const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(
  undefined
);

export const AuthSessionProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [authSession, setAuthSession] = useState<AuthSession | null>(() =>
    getStoredAuthSession()
  );
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const syncAuthSession = () => {
      setAuthSession(getStoredAuthSession());
    };

    window.addEventListener(AUTH_CHANGE_EVENT, syncAuthSession);
    window.addEventListener("storage", syncAuthSession);

    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, syncAuthSession);
      window.removeEventListener("storage", syncAuthSession);
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const hydrateAuthSession = async () => {
      try {
        const restoredSession = await restoreAuthSessionFromServer();

        if (isCancelled) {
          return;
        }

        if (restoredSession) {
          replaceStoredAuthSession(restoredSession);
          setAuthSession(restoredSession);
          return;
        }

        clearAuthSession();
        setAuthSession(null);
      } catch {
        if (!isCancelled) {
          setAuthSession(getStoredAuthSession());
        }
      } finally {
        if (!isCancelled) {
          setIsAuthReady(true);
        }
      }
    };

    void hydrateAuthSession();

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <AuthSessionContext.Provider value={{ authSession, isAuthReady }}>
      {children}
    </AuthSessionContext.Provider>
  );
};

export const useAuthSession = () => {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error("useAuthSession must be used within an AuthSessionProvider.");
  }

  return context;
};
