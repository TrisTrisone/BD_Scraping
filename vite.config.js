// import { defineConfig } from "vite";
// import react from "@vitejs/plugin-react";

// export default defineConfig({
//   plugins: [react()],
// });
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",             // ✅ Build folder for static assets
    emptyOutDir: true,          // Clean dist before each build
  },
  server: {
    port: 5173,                 // ✅ Local dev port
    proxy: {
      "/api": "http://localhost:3001", // ✅ Redirect API calls to backend during local dev
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"), // ✅ Optional alias
    },
  },
});
