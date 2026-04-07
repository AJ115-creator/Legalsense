import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig(({ mode }) => {
  // Merge .env file values with process.env so plugin works locally AND on Vercel.
  // process.env takes precedence (Vercel sets real shell env vars in dashboard).
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }

  return {
    plugins: [
      react(),
      tailwindcss(),
      // Uploads source maps when SENTRY_AUTH_TOKEN is present
      sentryVitePlugin({
        org: env.SENTRY_ORG,
        project: env.SENTRY_PROJECT,
        authToken: env.SENTRY_AUTH_TOKEN,
        release: {
          // Vercel injects VERCEL_GIT_COMMIT_SHA; falls back to "dev" locally
          name: env.VERCEL_GIT_COMMIT_SHA || env.VITE_GIT_COMMIT_SHA || 'dev',
        },
        sourcemaps: {
          // Delete .map files after upload so they're not served publicly
          filesToDeleteAfterUpload: ['./dist/**/*.map'],
        },
        disable: !env.SENTRY_AUTH_TOKEN,
      }),
    ],
    build: {
      sourcemap: true,
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})
