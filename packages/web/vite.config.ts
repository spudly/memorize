import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  resolve: {
    // Keep workspace symlinks (node_modules/@memorize/* -> packages/*) intact
    // so the CommonJS transform applies to @memorize/core's dist output.
    preserveSymlinks: true,
  },
});
