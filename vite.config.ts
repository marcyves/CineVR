import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig } from "vite";
import { smbGateway } from "./server/smbGateway.ts";

const https = process.env.HTTPS === "1";

function pagesBase(): string {
  const raw = process.env.BASE_PATH;
  if (!raw || raw === "./") return "./";
  return raw.endsWith("/") ? raw : `${raw}/`;
}

export default defineConfig({
  base: pagesBase(),
  plugins: [...(https ? [basicSsl()] : []), smbGateway()],
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
