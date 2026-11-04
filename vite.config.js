import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: "index.html",
        admin: "admin.html",
        adminRoute: "admin/index.html"
      }
    }
  }
});
