export default {
  base: process.env.VITE_BASE || '/',
  root: './src',
  publicDir: './public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './src/index.html',
        login: './src/login.html',
        leaderboard: './src/leaderboard.html',
        admin: './src/admin.html',
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
};
