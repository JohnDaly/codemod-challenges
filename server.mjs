import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { snapshot } from '@webcontainer/snapshot';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function createServer() {
  const app = express();

  // Create Vite server in middleware mode and configure the app type as
  // 'custom', disabling Vite's own HTML serving logic so parent server
  // can take control
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });

  // Use vite's connect instance as middleware. If you use your own
  // express router (express.Router()), you should use router.use
  // When the server restarts (for example after the user modifies
  // vite.config.js), `vite.middlewares` is still going to be the same
  // reference (with a new internal stack of Vite and plugin-injected
  // middlewares). The following is valid even after restarts.
  app.use(vite.middlewares);

  app.get('/filesystem-snapshot', async (req, res) => {
    const filesystemSnapshot = await snapshot(
      path.join(__dirname, './webcontainer')
    );
    res
      .setHeader('content-type', 'application/octet-stream')
      .send(filesystemSnapshot);
  });

  app.get('/loading.html', async (req, res) => {
    let template = fs.readFileSync(
      path.resolve(__dirname, 'loading.html'),
      'utf-8'
    );
    res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
  });

  app.get('/', async (req, res) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    let template = fs.readFileSync(
      path.resolve(__dirname, 'index.html'),
      'utf-8'
    );
    res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
  });

  app.use('*', async (req, res) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    const url = req.originalUrl;
    console.log('Request for: ', url);
  });

  app.listen(5173);
}

createServer();
