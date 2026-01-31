// Maps service - business logic

import { prisma } from '@db/prisma';
import { DEFAULT_GAME_PLAN_NOTES } from '@shared/constants';
import { mapPlayersForFrontend } from './helpers/player.helper';

// ============================================
// Types
// ============================================
export interface MapForFrontend {
  id: string;
  name: string;
  images: string[];
  assignments: unknown[];
  players: { userId: string; assignmentIds: number[]; mainAssignmentId: number | null }[];
  gamePlans: {
    id: string;
    name: string;
    assignments?: unknown;
    players?: { userId: string; assignmentIds: number[]; mainAssignmentId: number | null }[];
    notes?: unknown;
  }[];
  notes: unknown;
}

// ============================================
// Map queries
// ============================================

/**
 * Get all maps with game plans filtered by team
 */
export async function getAllMapsForTeam(teamId: string): Promise<MapForFrontend[]> {
  const maps = await prisma.map.findMany({
    orderBy: { name: 'asc' },
    include: {
      gamePlans: {
        where: { teamId },
        include: {
          players: {
            include: { player: { include: { user: true } } }
          }
        },
        orderBy: { name: 'asc' },
      },
    },
  });

  return maps.map(map => {
    const firstPlan = map.gamePlans[0];
    const assignments = firstPlan?.assignments as unknown[] || [];
    const players = firstPlan ? mapPlayersForFrontend(firstPlan.players) : [];

    const gamePlansWithData = map.gamePlans.map(gp => ({
      id: gp.id,
      name: gp.name,
      assignments: gp.assignments,
      players: mapPlayersForFrontend(gp.players),
      notes: gp.notes || DEFAULT_GAME_PLAN_NOTES,
    }));

    return {
      id: map.id,
      name: map.name,
      images: map.images as string[],
      assignments,
      players,
      gamePlans: gamePlansWithData,
      notes: firstPlan?.notes || DEFAULT_GAME_PLAN_NOTES,
    };
  });
}

/**
 * Get a single map with game plans filtered by team
 */
export async function getMapForTeam(mapId: string, teamId: string): Promise<MapForFrontend | null> {
  const map = await prisma.map.findUnique({
    where: { id: mapId },
    include: {
      gamePlans: {
        where: { teamId },
        include: {
          players: {
            include: { player: { include: { user: true } } }
          }
        },
        orderBy: { name: 'asc' },
      },
    },
  });

  if (!map) return null;

  const firstPlan = map.gamePlans[0];
  const assignments = firstPlan?.assignments as unknown[] || [];
  const players = firstPlan ? mapPlayersForFrontend(firstPlan.players) : [];

  return {
    id: map.id,
    name: map.name,
    images: map.images as string[],
    assignments,
    players,
    gamePlans: map.gamePlans.map(gp => ({ id: gp.id, name: gp.name })),
    notes: firstPlan?.notes || DEFAULT_GAME_PLAN_NOTES,
  };
}

/**
 * Get game plans for a specific map and team
 */
export async function getPlansForMapAndTeam(mapId: string, teamId: string) {
  const plans = await prisma.gamePlan.findMany({
    where: { mapId, teamId },
    orderBy: { name: 'asc' },
    include: {
      players: {
        include: {
          player: { include: { user: { select: { id: true, name: true } } } },
        },
      },
    },
  });

  return plans.map(plan => ({
    id: plan.id,
    name: plan.name,
    mapId: plan.mapId,
    assignments: plan.assignments,
    players: mapPlayersForFrontend(plan.players),
    notes: plan.notes || DEFAULT_GAME_PLAN_NOTES,
  }));
}

/**
 * Update or create a map
 */
export async function upsertMap(
  mapId: string,
  data: { name?: string; images?: string[]; template?: object }
) {
  return prisma.map.upsert({
    where: { id: mapId },
    update: {
      ...(data.name && { name: data.name }),
      ...(data.images && { images: data.images }),
      ...(data.template && { template: JSON.parse(JSON.stringify(data.template)) }),
    },
    create: {
      id: mapId,
      name: data.name || mapId,
      images: data.images || [],
      template: data.template || { assignments: [] },
    },
  });
}

/**
 * Create a new game plan for a map
 */
export async function createGamePlan(mapId: string, teamId: string, name?: string) {
  const map = await prisma.map.findUnique({ where: { id: mapId } });
  if (!map) return null;

  const template = map.template as { assignments: object[] };

  return prisma.gamePlan.create({
    data: {
      name: name || 'Nouveau plan',
      mapId,
      teamId,
      assignments: template?.assignments || [],
    },
  });
}
