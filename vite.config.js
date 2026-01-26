import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    root: '.', // Ensure root is the current directory
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
