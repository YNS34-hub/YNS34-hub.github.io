import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: "/",
  plugins: [react()],
  // 基线快照共用依赖目录时，各工作目录仍需独立的预构建缓存，避免懒加载资源返回 504。
  cacheDir: ".vite",
  optimizeDeps: { include: ["three/addons/objects/Reflector.js"] },
  server: { host: "0.0.0.0", allowedHosts: ["terminal.local"] },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three", "@react-three/fiber", "@react-three/drei"],
        },
      },
    },
  },
});
