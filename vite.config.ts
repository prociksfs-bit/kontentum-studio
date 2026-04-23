import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";

// Читаем версию из package.json
const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Подставляем версию приложения в код
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // Отключаем очистку экрана для Tauri
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});
