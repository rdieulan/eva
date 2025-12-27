// Types pour EVA

// Point d'un polygone
export interface Point {
  x: number;
  y: number;
}

// Zone peut être un rectangle (legacy), un polygone, ou plusieurs polygones (multi-zone)
export interface ZoneRect {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ZonePolygon {
  points: Point[];
}

export interface ZoneMulti {
  polygons: Point[][];
}

export type Zone = ZoneRect | ZonePolygon | ZoneMulti;

// Helper pour vérifier si une zone est un polygone simple
export function isZonePolygon(zone: Zone): zone is ZonePolygon {
  return 'points' in zone;
}

// Helper pour vérifier si une zone est multi-polygones
export function isZoneMulti(zone: Zone): zone is ZoneMulti {
  return 'polygons' in zone;
}

// Helper pour convertir un rectangle en polygone
export function rectToPolygon(zone: ZoneRect): ZonePolygon {
  return {
    points: [
      { x: zone.x1, y: zone.y1 },
      { x: zone.x2, y: zone.y1 },
      { x: zone.x2, y: zone.y2 },
      { x: zone.x1, y: zone.y2 },
    ]
  };
}

// Helper pour obtenir tous les polygones d'une zone
export function getZonePolygons(zone: Zone): Point[][] {
  if (isZoneMulti(zone)) {
    return zone.polygons;
  }
  if (isZonePolygon(zone)) {
    return [zone.points];
  }
  // ZoneRect
  return [rectToPolygon(zone).points];
}

// Helper pour obtenir les points d'une zone (premier polygone uniquement - legacy)
export function getZonePoints(zone: Zone): Point[] {
  const polygons = getZonePolygons(zone);
  return polygons[0] || [];
}

export interface Poste {
  id: string;
  nom: string;
  x: number;
  y: number;
  zone: Zone;
  etage?: number; // Pour les maps multi-étages (0, 1, etc.)
}

export interface MapConfig {
  id: string;
  nom: string;
  images: string[]; // Support pour plusieurs images (étages)
  postes: Poste[];
  joueurs: Record<string, string[]>;
}

export interface Joueur {
  id: string;
  nom: string;
}

export interface AppState {
  selectedMap: string | null;
  selectedJoueur: string | null;
  selectedEtage: number;
}

