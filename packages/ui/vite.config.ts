import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    emptyOutDir: false,
    ssr: "src/media-error-page.tsx",
    rollupOptions: {
      external: ["react", "react-dom/server.edge"],
      output: {
        format: "es",
        entryFileNames: "media-error-page.js",
      },
    },
  },
});
