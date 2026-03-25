/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type GoogleCredentialResponse = {
  credential?: string;
  select_by?: string;
};

type GoogleButtonConfiguration = {
  type?: "standard" | "icon";
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?:
    | "signin_with"
    | "signup_with"
    | "continue_with"
    | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  logo_alignment?: "left" | "center";
  width?: string | number;
};

type GoogleInitializeConfiguration = {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
};

interface Window {
  google?: {
    accounts: {
      id: {
        initialize: (configuration: GoogleInitializeConfiguration) => void;
        renderButton: (
          parent: HTMLElement,
          options: GoogleButtonConfiguration
        ) => void;
      };
    };
  };
}
