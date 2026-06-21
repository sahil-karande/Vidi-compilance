import { defineConfig } from 'vite';
import react from '@vitejs/react-plugin'; // or your existing react plugin import
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Adds fast native compilation
  ],
});