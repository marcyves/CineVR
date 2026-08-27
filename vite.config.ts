import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig } from "vite";

const https = process.env.HTTPS === "1";

export default defineConfig({
  plugins: https ? [basicSsl()] : [],
  server: {
    host: true,
    port: 43221,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 43221,
    strictPort: true,
  },
});
