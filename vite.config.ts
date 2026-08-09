import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: {
        // Vite 5 still calls Sass through the legacy JS API, which warns on
        // every build. Removable once this project moves to Vite 6+.
        api: "modern-compiler",
      },
    },
  },
  server: {
    port: 5173
  }
});
