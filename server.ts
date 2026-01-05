import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
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


app.use(cors());
app.use(express.json());

// Global request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${req.method}] ${req.path} - ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// ========== Authentication routes ==========
app.post('/api/auth/login', login);
app.post('/api/auth/logout', authMiddleware, logout);
app.get('/api/auth/me', authMiddleware, getCurrentUser);
app.post('/api/auth/change-password', authMiddleware, changePassword);

// ========== Map routes ==========

// Get all maps (metadata + template only, no game plans data)
app.get('/api/maps', async (_req: Request, res: Response) => {
  console.log('[API] GET /api/maps');
  try {
    const { prisma } = await import('./src/server/db');
    const maps = await prisma.map.findMany({
      orderBy: { name: 'asc' },
      include: {
        gamePlans: {
          include: {
            players: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    // Transform for frontend - use first GamePlan's data
    const mapsForFrontend = maps.map(map => {
      const firstPlan = map.gamePlans[0];
      const assignments = firstPlan?.assignments as unknown[] || [];
      const players = firstPlan?.players.map(gpp => ({
        userId: gpp.userId,
        assignmentIds: gpp.assignmentIds,
      })) || [];

      return {
        id: map.id,
        name: map.name,
        images: map.images as string[],
        assignments,
        players,
        gamePlans: map.gamePlans.map(gp => ({ id: gp.id, name: gp.name })),
      };
    });

    console.log('[API] Returning', mapsForFrontend.length, 'maps');
    res.json(mapsForFrontend);
  } catch (error) {
    console.error('[API] Error fetching maps:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a specific map (with template)
app.get('/api/maps/:mapId', async (req: Request, res: Response) => {
  const { mapId } = req.params;
  console.log('[API] GET /api/maps/' + mapId);

  try {
    const { prisma } = await import('./src/server/db');
    const map = await prisma.map.findUnique({
      where: { id: mapId },
      include: {
        gamePlans: {
          include: {
            players: true,
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!map) {
      console.log('[API] Map not found:', mapId);
      res.status(404).json({ error: 'Map not found' });
      return;
    }

    const firstPlan = map.gamePlans[0];
    const assignments = firstPlan?.assignments as unknown[] || [];
    const players = firstPlan?.players.map(gpp => ({
      userId: gpp.userId,
      assignmentIds: gpp.assignmentIds,
    })) || [];

    const mapForFrontend = {
      id: map.id,
      name: map.name,
      images: map.images as string[],
      assignments,
      players,
      gamePlans: map.gamePlans.map(gp => ({ id: gp.id, name: gp.name })),
    };

    console.log('[API] Returning map with', players.length, 'players');
    res.json(mapForFrontend);
  } catch (error) {
    console.error('[API] Error fetching map:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update map metadata and template (admin only)
app.post('/api/maps/:mapId', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  const { mapId } = req.params;
  const { name, images, template } = req.body;

  try {
    const { prisma } = await import('./src/server/db');

    await prisma.map.upsert({
      where: { id: mapId },
      update: {
        ...(name && { name }),
        ...(images && { images }),
        ...(template && { template: JSON.parse(JSON.stringify(template)) }),
      },
      create: {
        id: mapId,
        name: name || mapId,
        images: images || [],
        template: template || { assignments: [] },
      },
    });

    console.log(`Map updated by ${req.user?.email}: ${mapId}`);
    res.json({ success: true, message: `Map ${mapId} saved` });
  } catch (error) {
    console.error('Error saving map:', error);
    res.status(500).json({ success: false, message: 'Error saving map' });
  }
});

// ========== Game Plan routes ==========

// Get all game plans for a map
app.get('/api/maps/:mapId/plans', async (req: Request, res: Response) => {
  const { mapId } = req.params;

  try {
    const { prisma } = await import('./src/server/db');
    const plans = await prisma.gamePlan.findMany({
      where: { mapId },
      orderBy: { name: 'asc' },
      include: {
        players: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    // Transform for frontend
    const plansForFrontend = plans.map(plan => ({
      id: plan.id,
      name: plan.name,
      mapId: plan.mapId,
      assignments: plan.assignments,
      players: plan.players.map(gpp => ({
        userId: gpp.userId,
        assignmentIds: gpp.assignmentIds,
      })),
    }));

    res.json(plansForFrontend);
  } catch (error) {
    console.error('Error fetching game plans:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a specific game plan (returns full data for frontend)
app.get('/api/plans/:planId', async (req: Request, res: Response) => {
  const { planId } = req.params;

  try {
    const { prisma } = await import('./src/server/db');
    const plan = await prisma.gamePlan.findUnique({
      where: { id: planId },
      include: {
        map: true,
        players: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!plan) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }

    // Transform players to PlayerAssignment[] format for frontend
    const playerAssignments = plan.players.map(gpp => ({
      userId: gpp.userId,
      assignmentIds: gpp.assignmentIds,
    }));

    // Return in MapConfig-compatible format
    res.json({
      id: plan.map.id,
      name: plan.map.name,
      images: plan.map.images,
      assignments: plan.assignments,
      players: playerAssignments,
      planId: plan.id,
      planName: plan.name,
    });
  } catch (error) {
    console.error('Error fetching game plan:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new game plan (copy from template)
app.post('/api/maps/:mapId/plans', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  const { mapId } = req.params;
  const { name } = req.body;

  try {
    const { prisma } = await import('./src/server/db');

    // Get map template
    const map = await prisma.map.findUnique({ where: { id: mapId } });
    if (!map) {
      res.status(404).json({ error: 'Map not found' });
      return;
    }

    const template = map.template as { assignments: object[] };

    // Create GamePlan from template (no players - those are added separately via GamePlanPlayer)
    const plan = await prisma.gamePlan.create({
      data: {
        name: name || 'Nouveau plan',
        mapId,
        assignments: template?.assignments || [],
      },
    });

    console.log(`Game plan created by ${req.user?.email}: ${plan.id} for map ${mapId}`);
    res.json(plan);
  } catch (error) {
    console.error('Error creating game plan:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update a game plan
app.put('/api/plans/:planId', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  const { planId } = req.params;
  const { name, assignments, players } = req.body;

  console.log(`[API] PUT /api/plans/${planId}`);
  console.log('[API] User:', req.user?.email, '- Role:', req.user?.role);
  console.log('[API] Payload:', { name, assignmentsCount: assignments?.length, playersCount: players?.length });

  try {
    const { prisma } = await import('./src/server/db');

    // Update basic fields
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (assignments !== undefined) updateData.assignments = JSON.parse(JSON.stringify(assignments));

    console.log('[API] Updating plan with data:', Object.keys(updateData));

    const plan = await prisma.gamePlan.update({
      where: { id: planId },
      data: updateData,
    });

    console.log('[API] Plan updated successfully');

    // Update player assignments if provided
    if (players !== undefined && Array.isArray(players)) {
      console.log('[API] Updating player assignments...');

      // Delete existing player assignments
      await prisma.gamePlanPlayer.deleteMany({
        where: { gamePlanId: planId },
      });

      // Create new player assignments
      for (const playerAssignment of players as { userId: string; assignmentIds: number[] }[]) {
        if (playerAssignment.userId && playerAssignment.assignmentIds?.length > 0) {
          await prisma.gamePlanPlayer.create({
            data: {
              gamePlanId: planId,
              userId: playerAssignment.userId,
              assignmentIds: playerAssignment.assignmentIds,
            },
          });
        }
      }
      console.log('[API] Player assignments updated');
    }

    console.log(`[API] Game plan updated successfully by ${req.user?.email}: ${planId}`);
    res.json(plan);
  } catch (error) {
    console.error('[API] Error updating game plan:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete a game plan
app.delete('/api/plans/:planId', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  const { planId } = req.params;

  try {
    const { prisma } = await import('./src/server/db');

    const plan = await prisma.gamePlan.findUnique({ where: { id: planId } });
    if (!plan) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }

    await prisma.gamePlan.delete({ where: { id: planId } });

    console.log(`Game plan deleted by ${req.user?.email}: ${planId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting game plan:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== User routes (admin) ==========
app.get('/api/users', authMiddleware, adminMiddleware, async (_req: Request, res: Response) => {
  try {
    const { prisma } = await import('./src/server/db');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get players list (public - for frontend player selection)
app.get('/api/players', async (_req: Request, res: Response) => {
  try {
    const { prisma } = await import('./src/server/db');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== Serve frontend in production ==========
if (isProduction) {
  const distPath = path.join(__dirname, 'dist');

  app.use(express.static(distPath));

  app.use((_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`);
});
