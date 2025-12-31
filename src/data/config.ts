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
  { id: 'player2', nom: 'Kekew' },
  { id: 'player3', nom: 'Matic' },
  { id: 'player4', nom: 'Sib' },
  { id: 'player5', nom: 'Celesta' },
];

// Vérifier si une map a un effectif équilibré
export function checkMapBalance(map: MapConfig): { isBalanced: boolean; errors: string[] } {
  const errors: string[] = [];
  const postes = map.postes.map(p => p.id);

  // Pour chaque poste, trouver les joueurs qui le couvrent
  const posteToPlayers: Record<string, string[]> = {};

  for (const posteId of postes) {
    posteToPlayers[posteId] = [];
    for (const [playerId, playerPostes] of Object.entries(map.joueurs)) {
      if (playerPostes.includes(posteId)) {
        posteToPlayers[posteId]?.push(playerId);
      }
    }
  }

  // Règle 1 : Vérifier si un poste est tenu par moins de 2 joueurs
  for (const [posteId, players] of Object.entries(posteToPlayers)) {
    if (players.length < 2) {
      const poste = map.postes.find(p => p.id === posteId);
      const posteName = poste?.nom || posteId;
      if (players.length === 0) {
        errors.push(`${posteName} n'a aucun joueur`);
      } else {
        const playerName = joueurs.find(j => j.id === players[0])?.nom || players[0];
        errors.push(`${posteName} n'a que ${playerName}`);
      }
    }
  }

  // Règle 2 : Vérifier si un joueur ne couvre qu'un seul poste
  for (const [playerId, playerPostes] of Object.entries(map.joueurs)) {
    if (playerPostes.length < 2) {
      const playerName = joueurs.find(j => j.id === playerId)?.nom || playerId;
      if (playerPostes.length === 0) {
        errors.push(`${playerName} n'a aucun poste`);
      } else {
        const poste = map.postes.find(p => p.id === playerPostes[0]);
        const posteName = poste?.nom || playerPostes[0];
        errors.push(`${playerName} n'a que ${posteName}`);
      }
    }
  }

  // Règle 3 : Trouver les postes couverts par exactement 2 joueurs
  const postesWithTwoPlayers: { posteId: string; players: string[] }[] = [];

  for (const [posteId, players] of Object.entries(posteToPlayers)) {
    if (players.length === 2) {
      postesWithTwoPlayers.push({ posteId, players: players.sort() });
    }
  }

  // Vérifier si deux postes partagent la même paire de joueurs
  const pairToPostes: Record<string, string[]> = {};

  for (const { posteId, players } of postesWithTwoPlayers) {
    const pairKey = players.join('-');
    if (!pairToPostes[pairKey]) {
      pairToPostes[pairKey] = [];
    }
    pairToPostes[pairKey]?.push(posteId);
  }

  for (const [pairKey, posteIds] of Object.entries(pairToPostes)) {
    if (posteIds.length > 1) {
      const pair = pairKey.split('-');
      const playerNames = pair.map(pid => joueurs.find(j => j.id === pid)?.nom || pid);
      const posteNames = posteIds.map(pid => {
        const poste = map.postes.find(p => p.id === pid);
        return poste?.nom || pid;
      });
      errors.push(`${posteNames.join(' et ')} sont couverts uniquement par ${playerNames.join(' et ')}`);
    }
  }

  return {
    isBalanced: errors.length === 0,
    errors
  };
}

