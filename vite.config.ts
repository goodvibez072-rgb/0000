import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { cartographer } from "@replit/vite-plugin-cartographer";
import errorModal from "@replit/vite-plugin-runtime-error-modal";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine if we're in Replit environment
const isReplit = !!process.env.REPLIT_DEV_DOMAIN;
const replitDomain = process.env.REPLIT_DEV_DOMAIN || 'localhost';

export default defineConfig({
  plugins: [
    react(),
    cartographer(),
    errorModal(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@db": path.resolve(__dirname, "./db"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  root: path.resolve(__dirname, "client"),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    // PERFORMANCE OPTIMIZATION: Advanced build configuration
    minify: 'esbuild', // Use esbuild for faster, efficient minification
    // Optimize chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          'react-vendor': ['react', 'react-dom', 'react-hook-form', 'wouter'],
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu', 
            '@radix-ui/react-select',
            '@radix-ui/react-toast',
            '@radix-ui/react-tabs',
          ],
          'chart-vendor': ['chart.js', 'react-chartjs-2'],
          'utils-vendor': ['date-fns', 'clsx', 'tailwind-merge', 'zod'],
        },
      },
    },
    // Increase chunk size warning limit (we're optimizing it)
    chunkSizeWarningLimit: 1000,
    // Disable source maps for smaller production builds
    sourcemap: false,
  },
  // PERFORMANCE: Remove console logs in production via esbuild
  esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
  },
  // PERFORMANCE: Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom', 
      'react-hook-form',
      'wouter',
      '@tanstack/react-query',
      'chart.js',
      'react-chartjs-2',
    ],
  },
  server: {
    host: '0.0.0.0',
    port: 5000,
    strictPort: true,
    allowedHosts: true,
  },
});
