import type { Joueur, MapConfig } from '../types';

// Liste des IDs de maps disponibles
export const mapIds = [
  'artefact',
  'atlantis',
  'ceres',
  'engine',
  'helios',
  'horizon',
  'lunar',
  'outlaw',
  'polaris',
  'silva',
  'thecliff',
];

// Charge une map depuis son fichier JSON
export async function loadMap(mapId: string): Promise<MapConfig> {
  const response = await fetch(`/maps/${mapId}/${mapId}.json`);
  if (!response.ok) {
    throw new Error(`Failed to load map: ${mapId}`);
  }
  return response.json();
}

// Charge toutes les maps
export async function loadAllMaps(): Promise<MapConfig[]> {
  const maps = await Promise.all(mapIds.map(loadMap));
  return maps;
}

// Couleurs des postes (fixes pour toutes les maps)
export const posteColors: Record<string, string> = {
  poste1: '#ff6b6b',
  poste2: '#4ecdc4',
  poste3: '#ffe66d',
  poste4: '#a66cff',
};

// Configuration des joueurs
export const joueurs: Joueur[] = [
  { id: 'player1', nom: 'Nyork' },
  { id: 'player2', nom: 'Matic' },
  { id: 'player3', nom: 'Kekew' },
  { id: 'player4', nom: 'Sib' },
  { id: 'player5', nom: 'Celesta' },
];
