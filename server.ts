import express, { Request, Response } from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import type { MapConfig } from './src/types';

const app = express();
const PORT = 3001;

// Chemin racine du projet
const rootDir = process.cwd();

app.use(cors());
app.use(express.json());

// Endpoint pour sauvegarder une map
app.post('/api/maps/:mapId', async (req: Request, res: Response) => {
  const { mapId } = req.params;
  const mapData: MapConfig = req.body;

  const filePath = path.join(rootDir, 'public', 'maps', mapId, `${mapId}.json`);

  try {
    await fs.writeFile(filePath, JSON.stringify(mapData, null, 2), 'utf-8');
    console.log(`Map sauvegardée: ${filePath}`);
    res.json({ success: true, message: `Map ${mapId} sauvegardée` });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la sauvegarde' });
  }
});

app.listen(PORT, () => {
  console.log(`Serveur API démarré sur http://localhost:${PORT}`);
});

