import { useEffect, useRef, useState } from "react";
import { authApiBaseUrl, parseResponsePayload } from "../../lib/auth";
import LoadingIndicator from "../common/LoadingIndicator";

type GoogleSignInButtonProps = {
  disabled?: boolean;
  onCredential: (credential: string) => void | Promise<void>;
  onError: (message: string) => void;
};

const googleScriptId = "google-identity-services-script";
const envGoogleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";

type AuthConfigResponse = {
  googleSignInEnabled?: boolean;
  googleClientId?: string | null;
};

const loadGoogleIdentityScript = () =>
  new Promise<void>((resolve, reject) => {
    if (window.google?.accounts.id) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(
      googleScriptId
    ) as HTMLScriptElement | null;

    const handleLoad = () => {
      if (existingScript) {
        existingScript.dataset.loaded = "true";
      }
      resolve();
    };

    const handleError = () => {
      reject(new Error("Unable to load the Google Identity Services script."));
    };

    if (existingScript) {
      if (
        existingScript.dataset.loaded === "true" &&
        window.google?.accounts.id
      ) {
        resolve();
        return;
      }

      existingScript.addEventListener("load", handleLoad, { once: true });
      existingScript.addEventListener("error", handleError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = googleScriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true }
    );
    script.addEventListener(
      "error",
      () => {
        reject(new Error("Unable to load the Google Identity Services script."));
      },
      { once: true }
    );

    document.head.appendChild(script);
  });

export default function GoogleSignInButton({
  disabled = false,
  onCredential,
  onError,
}: GoogleSignInButtonProps) {
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const onCredentialRef = useRef(onCredential);
  const onErrorRef = useRef(onError);
  const [isReady, setIsReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Loading Google sign-in...");
  const [googleClientId, setGoogleClientId] = useState("");
  const isLoadingStatus =
    statusMessage === "Loading Google sign-in..." ||
    statusMessage === "Checking Google sign-in configuration...";

  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    let isCancelled = false;

    const resolvedEnvClientId =
      envGoogleClientId && !envGoogleClientId.startsWith("replace-with-")
        ? envGoogleClientId
        : "";

    if (resolvedEnvClientId) {
      setGoogleClientId(resolvedEnvClientId);
      return;
    }

    setStatusMessage("Checking Google sign-in configuration...");

    fetch(`${authApiBaseUrl}/api/auth/config`)
      .then(async (response) => {
        const rawResponse = await response.text();
        const payload = parseResponsePayload<AuthConfigResponse>(rawResponse);

        if (!response.ok) {
          throw new Error("Unable to load auth configuration.");
        }

        if (isCancelled) {
          return;
        }

        if (
          payload?.googleSignInEnabled &&
          typeof payload.googleClientId === "string" &&
          payload.googleClientId.trim()
        ) {
          setGoogleClientId(payload.googleClientId.trim());
          return;
        }

        setStatusMessage("Google sign-in is unavailable.");
        onErrorRef.current(
          "Google sign-in is not configured. Add GOOGLE_CLIENT_ID to server/.env."
        );
      })
      .catch(() => {
        if (!isCancelled) {
          setStatusMessage("Google sign-in is unavailable.");
          onErrorRef.current(
            "Unable to load Google sign-in settings from the server."
          );
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    if (!googleClientId) {
      setIsReady(false);
      return;
    }

    const renderGoogleButton = () => {
      if (
        isCancelled ||
        !buttonContainerRef.current ||
        !window.google?.accounts.id
      ) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          if (!response.credential) {
            onErrorRef.current(
              "Google sign-in did not return a credential. Please try again."
            );
            return;
          }

          await onCredentialRef.current(response.credential);
        },
      });

      buttonContainerRef.current.innerHTML = "";
      const availableWidth = buttonContainerRef.current.clientWidth || 320;
      const buttonWidth = Math.max(200, Math.min(availableWidth, 320));
      window.google.accounts.id.renderButton(buttonContainerRef.current, {
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: buttonWidth,
      });

      setIsReady(true);
      setStatusMessage("Loading Google sign-in...");
    };

    setIsReady(false);
    setStatusMessage("Loading Google sign-in...");

    loadGoogleIdentityScript()
      .then(() => {
        if (isCancelled) {
          return;
        }

        renderGoogleButton();
      })
      .catch(() => {
        if (!isCancelled) {
          setIsReady(false);
          setStatusMessage("Google sign-in is unavailable.");
          onErrorRef.current("Unable to load Google sign-in right now.");
        }
      });

    return () => {
      isCancelled = true;

      if (buttonContainerRef.current) {
        buttonContainerRef.current.innerHTML = "";
      }
    };
  }, [googleClientId]);

  return (
    <div
      className={`w-full min-h-12 rounded-lg ${
        disabled ? "pointer-events-none opacity-60" : ""
      }`}
    >
      <div ref={buttonContainerRef} className="flex w-full justify-center" />
      {!isReady ? (
        <div className="flex h-12 w-full items-center justify-center rounded-lg border border-gray-200 bg-gray-100 px-4 text-sm text-gray-500 dark:border-gray-800 dark:bg-white/5 dark:text-gray-400">
          {isLoadingStatus ? (
            <LoadingIndicator label={statusMessage} size="sm" />
          ) : (
            statusMessage
          )}
        </div>
      ) : null}
    </div>
  );
}
