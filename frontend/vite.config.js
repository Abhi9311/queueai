import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxies /api and /ws to the FastAPI backend during local development,
// so the frontend can just call same-origin paths and never hardcode
// http://localhost:8000 anywhere in application code.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://127.0.0.1:8000",
        ws: true,
      },
    },
  },
});
