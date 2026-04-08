import type { EnvCliConfig } from "../Cernere/packages/env-cli/src/types.js";

const config: EnvCliConfig = {
  name: "Ars",

  /**
   * Docker Compose / アプリケーションが .env から読むインフラキー。
   * Infisical に同名キーがあればそちらを優先し、なければデフォルト値を使用。
   */
  infraKeys: {
    // ─── Ars Web Server ───────────────────────────────────
    ARS_LISTEN_ADDR: "0.0.0.0:5173",

    // ─── Vite Dev Server ────────────────────────────────────
    ARS_BACKEND_URL: "http://localhost:5173",
    VITE_ALLOWED_HOSTS: "",

    // ─── Cernere 連携 ─────────────────────────────────────
    CERNERE_URL: "http://localhost:8080",
  },

  defaultSiteUrl: "https://app.infisical.com",
  defaultEnvironment: "dev",
};

export default config;
