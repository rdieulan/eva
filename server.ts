import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { MapConfig } from './src/types';
import {
  login,
  logout,
  getCurrentUser,
  changePassword,
  authMiddleware,
  adminMiddleware,
} from './src/server/auth';
import type { AuthRequest } from './src/server/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Chemin racine du projet
const rootDir = process.cwd();

app.use(cors());
app.use(express.json());

// ========== Routes d'authentification ==========
app.post('/api/auth/login', login);
app.post('/api/auth/logout', authMiddleware, logout);
app.get('/api/auth/me', authMiddleware, getCurrentUser);
app.post('/api/auth/change-password', authMiddleware, changePassword);

// ========== Routes des maps ==========

// Endpoint pour sauvegarder une map (admin seulement)
app.post('/api/maps/:mapId', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  const { mapId } = req.params;
  const mapData: MapConfig = req.body;

  const filePath = path.join(rootDir, 'public', 'maps', mapId, `${mapId}.json`);

  try {
    await fs.writeFile(filePath, JSON.stringify(mapData, null, 2), 'utf-8');
    console.log(`Map sauvegardée par ${req.user?.email}: ${filePath}`);
    res.json({ success: true, message: `Map ${mapId} sauvegardée` });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la sauvegarde' });
  }
});

// Endpoint pour sauvegarder une map (sans auth, pour dev)
app.post('/api/maps-dev/:mapId', async (req: Request, res: Response) => {
  const { mapId } = req.params;
  const mapData: MapConfig = req.body;

  const filePath = path.join(rootDir, 'public', 'maps', mapId, `${mapId}.json`);

  try {
    await fs.writeFile(filePath, JSON.stringify(mapData, null, 2), 'utf-8');
    console.log(`Map sauvegardée (dev): ${filePath}`);
    res.json({ success: true, message: `Map ${mapId} sauvegardée` });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la sauvegarde' });
  }
});

// ========== Routes des utilisateurs (admin) ==========
app.get('/api/users', authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
  try {
    const { prisma } = await import('./src/server/db');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        nom: true,
        role: true,
        createdAt: true,
      },
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ========== Servir le frontend en production ==========
if (isProduction) {
  const distPath = path.join(__dirname, 'dist');

  // Servir les fichiers statiques
  app.use(express.static(distPath));

  // Pour toutes les autres routes, renvoyer index.html (SPA)
  app.use((_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`);
});

