import express from "express";
import path from "path";
import { createApp } from "./server/app";
import { DispatchService } from "./server/services/dispatch.service";
import { RealtimeHub, realtimePaths } from "./server/realtime/hub";

async function startServer() {
  const app = createApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    // Import dinámico: en producción (cPanel) no hace falta instalar vite.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Express 4: '*' (el patrón '*all' era de Express 5 y nunca coincidía).
    // Las rutas /api/ desconocidas responden 404 en JSON, no la página web.
    app.get('*', (req, res) => {
      if (req.path.includes('/api/')) {
        return res.status(404).json({ success: false, message: 'Ruta no encontrada.' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Barrido de despacho (ofertas vencidas -> siguiente motorizado). Solo si hay MySQL configurado.
  if (process.env.DB_NAME) DispatchService.startSweeper();

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Zénith Backend Server running on http://localhost:${PORT}`);
  });

  // Tiempo real: avisos al instante por WebSocket (la app sigue funcionando sin él).
  new RealtimeHub(realtimePaths()).attach(server);
}

startServer();
