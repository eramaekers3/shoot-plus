import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Lets `npm run dev` answer /api/stripe the same way Vercel does in production.
function devApi() {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api/stripe', async (req, res) => {
        const send = (status, data) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };
        const url = new URL(req.url, 'http://localhost');
        const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
        const { handle } = await server.ssrLoadModule('/api/stripe.js');
        await handle({ token, since: url.searchParams.get('since') }, send);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // The server function reads STRIPE_SECRET_KEY and STRIPE_OWNER_EMAIL from .env when running locally.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    plugins: [react(), devApi()],
    // Accept both Vite-style and Next.js-style names for the Supabase keys.
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    build: {
      rollupOptions: {
        output: {
          // Libraries change rarely, so they get their own files that phones keep cached across app updates.
          manualChunks: { react: ['react', 'react-dom'], supabase: ['@supabase/supabase-js'] },
        },
      },
    },
  };
});
