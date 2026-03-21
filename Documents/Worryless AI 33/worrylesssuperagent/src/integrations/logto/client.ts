// Logto OIDC configuration for Worryless AI
//
// Prerequisites (Logto Admin Console):
// 1. Create a "Traditional Web" or "SPA" application in Logto
// 2. Enable email/password sign-in experience
// 3. Register redirect URI: <frontend-origin>/callback
// 4. (Optional) Add Google social connector for OAuth — see RESEARCH.md Pattern 5
// 5. Create an API resource for the backend and note its identifier
//
// Required env vars:
//   VITE_LOGTO_ENDPOINT   — Logto tenant endpoint (e.g. https://xxx.logto.app)
//   VITE_LOGTO_APP_ID     — Application ID from Logto console
//   VITE_LOGTO_API_RESOURCE — API resource identifier for backend access tokens

import { LogtoConfig } from '@logto/react';

export const logtoConfig: LogtoConfig = {
  endpoint: import.meta.env.VITE_LOGTO_ENDPOINT,
  appId: import.meta.env.VITE_LOGTO_APP_ID,
  resources: [import.meta.env.VITE_LOGTO_API_RESOURCE],
};
