import { defineConfig } from 'vite';
import { resolve } from 'path';
import compression from 'vite-plugin-compression';

export default defineConfig({
    root: '.', // Ensure root is the current directory
    plugins: [
        // Phase 2: Brotli compression for 30-40% smaller bundles
        compression({
            algorithm: 'brotliCompress',
            ext: '.br',
            threshold: 10240, // Only compress files > 10KB
        }),
        // Gzip fallback for older browsers
        compression({
            algorithm: 'gzip',
            ext: '.gz',
            threshold: 10240,
        }),
    ],
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                tutors: resolve(__dirname, 'tutors.html'),
                counselors: resolve(__dirname, 'counselors.html'),
                buddies: resolve(__dirname, 'buddies.html'),
                booking: resolve(__dirname, 'booking.html'),
                auth: resolve(__dirname, 'src/auth.html'),
                onboarding: resolve(__dirname, 'onboarding.html'),
                dashboardStudent: resolve(__dirname, 'dashboard-student.html'),
                dashboardTutor: resolve(__dirname, 'dashboard-tutor.html'),
                dashboardCounselor: resolve(__dirname, 'counselor-dashboard.html'),
                profile: resolve(__dirname, 'profile.html'),
            },
        },
    },
    server: {
        open: true
    }
});
