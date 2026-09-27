/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_SAAS_SHARED?: string;
  readonly VITE_CENTRAL_LOGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
