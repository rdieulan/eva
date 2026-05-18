// Game plans service - business logic

import { prisma } from '@db/prisma';
import { DEFAULT_GAME_PLAN_NOTES, ERROR } from '@shared/constants';
import { mapPlayersForFrontend } from './helpers/player.helper';
import { migrateAssignmentsToPhases, type Assignment } from './helpers/migration.helper';
import type { PlayerAssignment } from '@shared/types';

// ============================================
// Types
// ============================================
export interface PlanForFrontend {
  id: string;
  name: string;
  images: unknown;
  assignments: unknown;
  players: PlayerAssignment[];
  planId: string;
  planName: string;
  notes: unknown;
}

export interface PlayerAssignmentInput {
  playerId: string;
  assignmentIds: number[];
  mainAssignmentId?: number;
}

// ============================================
// Plan queries
// ============================================

/**
 * Get a game plan by ID
 */
export async function getPlanById(planId: string, teamId?: string) {
  const plan = await prisma.gamePlan.findUnique({
    where: { id: planId },
    include: {
      map: true,
      players: {
        include: {
          player: { include: { user: { select: { id: true, name: true } } } },
        },
      },
    },
  });

  if (!plan) return null;

  // Verify plan belongs to user's team
  if (teamId && plan.teamId && plan.teamId !== teamId) {
    return { accessDenied: true };
  }

  const playerAssignments = mapPlayersForFrontend(plan.players);

  return {
    id: plan.map.id,
    name: plan.map.name,
    images: plan.map.images,
    assignments: plan.assignments,
    players: playerAssignments,
    planId: plan.id,
    planName: plan.name,
    notes: plan.notes || DEFAULT_GAME_PLAN_NOTES,
  };
}

/**
 * Update a game plan
 */
export async function updatePlan(
  planId: string,
  data: {
    name?: string;
    assignments?: Assignment[];
    players?: PlayerAssignmentInput[];
    notes?: unknown;
  },
  teamId?: string
): Promise<{ success: boolean; error?: string; plan?: unknown }> {
  // Verify plan exists and belongs to user's team
  const existingPlan = await prisma.gamePlan.findUnique({ where: { id: planId } });
  if (!existingPlan) {
    return { success: false, error: ERROR.planNotFound };
  }
  if (teamId && existingPlan.teamId && existingPlan.teamId !== teamId) {
    return { success: false, error: ERROR.accessDenied };
  }

  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;

  // Migrate legacy zones if assignments provided
  if (data.assignments !== undefined) {
    const migratedAssignments = migrateAssignmentsToPhases(data.assignments);
    updateData.assignments = JSON.parse(JSON.stringify(migratedAssignments));
  }

  if (data.notes !== undefined) {
    updateData.notes = JSON.parse(JSON.stringify(data.notes));
  }

  const plan = await prisma.gamePlan.update({
    where: { id: planId },
    data: updateData,
  });

  // Update player assignments if provided
  if (data.players !== undefined && Array.isArray(data.players)) {
    await prisma.gamePlanPlayer.deleteMany({
      where: { gamePlanId: planId },
    });

    for (const playerAssignment of data.players) {
      if (playerAssignment.playerId && playerAssignment.assignmentIds?.length > 0) {
        await prisma.gamePlanPlayer.create({
          data: {
            gamePlanId: planId,
            playerId: playerAssignment.playerId,
            assignmentIds: playerAssignment.assignmentIds,
            mainAssignmentId: playerAssignment.mainAssignmentId ?? null,
          },
        });
      }
    }
  }

  return { success: true, plan };
}

/**
 * Delete a game plan
 */
export async function deletePlan(
  planId: string,
  teamId?: string
): Promise<{ success: boolean; error?: string }> {
  const plan = await prisma.gamePlan.findUnique({ where: { id: planId } });
  if (!plan) {
    return { success: false, error: ERROR.planNotFound };
  }

  // Verify plan belongs to user's team
  if (teamId && plan.teamId && plan.teamId !== teamId) {
    return { success: false, error: ERROR.accessDenied };
  }

  await prisma.gamePlan.delete({ where: { id: planId } });
  return { success: true };
}
