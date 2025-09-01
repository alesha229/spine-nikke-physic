import { defineConfig } from "vite";

// Определяем режим работы
const isDev = process.env.NODE_ENV === "development";
const isProduction = process.env.NODE_ENV === "production";

// Динамически определяем base path
const base = isDev ? "/" : "/spine-nikke-physic/";

console.log(`🚀 Vite Config: Mode=${process.env.NODE_ENV}, Base=${base}`);

export default defineConfig({
  base,
  server: {
    port: 3000,
    host: true,
    open: true,
    cors: true,
  },
  preview: {
    port: 4173,
    host: true,
    open: true,
  },
  build: {
    outDir: "dist",
    sourcemap: isDev,
    minify: isProduction,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["pixi.js", "@pixi-spine/all-4.1"],
        },
      },
    },
  },
  // Оптимизация для production
  optimizeDeps: {
    include: ["pixi.js", "@pixi-spine/all-4.1"],
  },
  // Логирование для отладки
  logLevel: "info",
  clearScreen: false,
});
