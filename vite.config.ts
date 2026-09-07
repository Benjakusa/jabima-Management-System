import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: './',
  server: {
    host: "::",
    port: 8080,
    deps: {
      externalize: ['react-native'],
    },
  },
  plugins: [
    react(),
    // VitePWA disabled due to incompatibility with react-native-fs
    // Will be re-enabled after the build issue is resolved
  ],
  optimizeDeps: {
    exclude: ['react-native-fs', 'react-native'],
  },
  // Externalize react-native-fs for build only
  external: ['react-native-fs'],
  esbuild: {
    target: 'es2020',
    logLevel: 'warning',
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  // Configure rollup to treat react-native-fs as external
  // and use esbuild-only transformation
  build: {
    target: 'es2020',
    minify: mode === 'production' ? 'esbuild' : false,
    rollupOptions: {
      external: ['react-native-fs', 'react-native'],
      output: {
        // Don't try to parse react-native-fs
        manualChunks: {
          vendor: ['react', 'react-dom'],
        },
      },
      onwarn: (warning, warn) => {
        if (warning.code === 'IS_POTENTIALLY_IMPORTED_MEMBER' && 
            warning.text.includes('react-native-fs')) {
          return;
        }
        if (warning.code && warning.code.includes('commonjs')) {
          return;
        }
        warn(warning);
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));