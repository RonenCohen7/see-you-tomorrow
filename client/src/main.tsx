import React from "react";
import ReactDOM from "react-dom/client";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Use Emotion's default Stylis pipeline (prefixer, etc.). Do not inject `stylis-plugin-rtl`
// here: Vite's prebundle can produce bad CJS interop for cssjanus (`*.default` undefined),
// which crashes at runtime with "Cannot read properties of undefined (reading 'default')".
// RTL still comes from `<html dir="rtl">`, theme `direction: "rtl"`, and MUI's RTL-aware layout.
const cacheRtl = createCache({
  key: "muirtl",
  prepend: true,
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <CacheProvider value={cacheRtl}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </CacheProvider>
  </React.StrictMode>
);
