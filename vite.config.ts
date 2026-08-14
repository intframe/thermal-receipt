// Vite config: dev server runs the demo app, build produces the library bundle.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: "src/index.ts",
      name: "ThermalReceipt",
      formats: ["es"],
      fileName: "thermal-receipt",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
    },
  },
});
