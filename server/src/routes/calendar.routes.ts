// Calendar routes - Availability and Events

import { Router } from 'express';
import type { Response } from 'express';
import { prisma } from '@db/prisma';
import { authMiddleware, adminMiddleware } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import type {
  SetAvailabilityRequest,
  CreateEventRequest,
  DayData,
  PlayerAvailability,
} from '@shared/types';

const router = Router();

// Helper function to format date as YYYY-MM-DD without UTC conversion
function formatDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ===========================================
// Availability Routes
// ===========================================

// GET /api/calendar/availability?month=YYYY-MM
// Get all availabilities for a month (all users)
router.get('/availability', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { month } = req.query;

  if (!month || typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ error: 'Paramètre month requis (format YYYY-MM)' });
    return;
  }

  try {
    // Parse month to get date range
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0); // Last day of month

    // Fetch all availabilities for the month
    const availabilities = await prisma.availability.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });

    // Fetch all users for the player list
    const users = await prisma.user.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    // Fetch all events for the month
    const events = await prisma.calendarEvent.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    // Build response: group by date
    const days: Record<string, DayData> = {};

    // Initialize all days of the month
    for (let day = 1; day <= endDate.getDate(); day++) {
      const date = new Date(year, monthNum - 1, day);
      const dateStr = formatDateStr(date);

      const playerAvailabilities: PlayerAvailability[] = users.map(user => ({
        userId: user.id,
        userName: user.name,
        status: null,
      }));

      days[dateStr] = {
        date: dateStr,
        currentUserStatus: null,
        playerAvailabilities,
        events: [],
      };
    }

    // Fill in availabilities
    for (const availability of availabilities) {
      const dateStr = formatDateStr(availability.date);
      const dayData = days[dateStr];

      if (dayData) {
        // Update player availability
        const playerAvail = dayData.playerAvailabilities.find(
          p => p.userId === availability.userId
        );
        if (playerAvail) {
          playerAvail.status = availability.status;
        }

        // Update current user status
        if (availability.userId === req.user!.userId) {
          dayData.currentUserStatus = availability.status;
        }
      }
    }

    // Fill in events
    for (const event of events) {
      const dateStr = formatDateStr(event.date);
      const dayData = days[dateStr];

      if (dayData) {
        dayData.events.push({
          id: event.id,
          date: dateStr,
          startTime: event.startTime,
          endTime: event.endTime,
          type: event.type,
          title: event.title,
          description: event.description || undefined,
          gamePlan: event.gamePlan as any || undefined,
          createdById: event.createdById,
          createdAt: event.createdAt.toISOString(),
        });
      }
    }

    res.json({ month, days });
  } catch (error) {
    console.error('[CALENDAR] Error fetching availability:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/calendar/availability
// Set or remove availability for current user
router.post('/availability', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { date, status } = req.body as SetAvailabilityRequest;
  const userId = req.user!.userId;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'Date invalide (format YYYY-MM-DD requis)' });
    return;
  }

  try {
    const dateObj = new Date(date);

    if (status === null) {
      // Remove availability
      await prisma.availability.deleteMany({
        where: { userId, date: dateObj },
      });
      res.json({ success: true, deleted: true });
    } else if (status === 'AVAILABLE' || status === 'CONDITIONAL' || status === 'UNAVAILABLE') {
      // Upsert availability
      const availability = await prisma.availability.upsert({
        where: {
          userId_date: { userId, date: dateObj },
        },
        create: {
          userId,
          date: dateObj,
          status,
        },
        update: {
          status,
        },
      });

      res.json({
        id: availability.id,
        userId: availability.userId,
        date: formatDateStr(availability.date),
        status: availability.status,
      });
    } else {
      res.status(400).json({ error: 'Status invalide' });
    }
  } catch (error) {
    console.error('[CALENDAR] Error setting availability:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ===========================================
// Event Routes (Admin only)
// ===========================================

// GET /api/calendar/events?month=YYYY-MM
// Get all events for a month
router.get('/events', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { month } = req.query;

  if (!month || typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
    res.status(400).json({ error: 'Paramètre month requis (format YYYY-MM)' });
    return;
  }

  try {
    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0);

    const events = await prisma.calendarEvent.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    res.json(
      events.map(event => ({
        id: event.id,
        date: formatDateStr(event.date),
        startTime: event.startTime,
        endTime: event.endTime,
        type: event.type,
        title: event.title,
        description: event.description || undefined,
        gamePlan: event.gamePlan || undefined,
        createdById: event.createdById,
        createdAt: event.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error('[CALENDAR] Error fetching events:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/calendar/events
// Create a new event (Admin only)
router.post('/events', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  const { date, startTime, endTime, type, title, description } = req.body as CreateEventRequest;
  const createdById = req.user!.userId;

  // Validation
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'Date invalide (format YYYY-MM-DD requis)' });
    return;
  }
  if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) {
    res.status(400).json({ error: 'Heure de début invalide (format HH:mm requis)' });
    return;
  }
  if (!endTime || !/^\d{2}:\d{2}$/.test(endTime)) {
    res.status(400).json({ error: 'Heure de fin invalide (format HH:mm requis)' });
    return;
  }
  if (!type || !['MATCH', 'EVENT'].includes(type)) {
    res.status(400).json({ error: 'Type invalide (MATCH ou EVENT requis)' });
    return;
  }
  if (!title || title.trim().length === 0) {
    res.status(400).json({ error: 'Titre requis' });
    return;
  }

  try {
    const event = await prisma.calendarEvent.create({
      data: {
        date: new Date(date),
        startTime,
        endTime,
        type,
        title: title.trim(),
        description: description?.trim() || null,
        createdById,
      },
    });

    res.status(201).json({
      id: event.id,
      date: formatDateStr(event.date),
      startTime: event.startTime,
      endTime: event.endTime,
      type: event.type,
      title: event.title,
      description: event.description || undefined,
      gamePlan: event.gamePlan || undefined,
      createdById: event.createdById,
      createdAt: event.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('[CALENDAR] Error creating event:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// DELETE /api/calendar/events/:id
// Delete an event (Admin only)
router.delete('/events/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  try {
    const event = await prisma.calendarEvent.findUnique({ where: { id } });

    if (!event) {
      res.status(404).json({ error: 'Événement non trouvé' });
      return;
    }

    await prisma.calendarEvent.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    console.error('[CALENDAR] Error deleting event:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/calendar/events/:id
// Update an event (Admin only)
router.put('/events/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { date, startTime, endTime, type, title, description } = req.body as CreateEventRequest;

  // Validation
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'Date invalide (format YYYY-MM-DD requis)' });
    return;
  }
  if (startTime && !/^\d{2}:\d{2}$/.test(startTime)) {
    res.status(400).json({ error: 'Heure de début invalide (format HH:mm requis)' });
    return;
  }
  if (endTime && !/^\d{2}:\d{2}$/.test(endTime)) {
    res.status(400).json({ error: 'Heure de fin invalide (format HH:mm requis)' });
    return;
  }
  if (type && !['MATCH', 'EVENT'].includes(type)) {
    res.status(400).json({ error: 'Type invalide (MATCH ou EVENT requis)' });
    return;
  }

  try {
    const existingEvent = await prisma.calendarEvent.findUnique({ where: { id } });

    if (!existingEvent) {
      res.status(404).json({ error: 'Événement non trouvé' });
      return;
    }

    const event = await prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(date && { date: new Date(date) }),
        ...(startTime && { startTime }),
        ...(endTime && { endTime }),
        ...(type && { type }),
        ...(title && { title: title.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
      },
    });

    res.json({
      id: event.id,
      date: formatDateStr(event.date),
      startTime: event.startTime,
      endTime: event.endTime,
      type: event.type,
      title: event.title,
      description: event.description || undefined,
      gamePlan: event.gamePlan || undefined,
      createdById: event.createdById,
      createdAt: event.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('[CALENDAR] Error updating event:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// PUT /api/calendar/events/:id/gameplan
// Update the game plan for an event (Admin only)
router.put('/events/:id/gameplan', authMiddleware, adminMiddleware, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { gamePlan } = req.body;

  try {
    const existingEvent = await prisma.calendarEvent.findUnique({ where: { id } });

    if (!existingEvent) {
      res.status(404).json({ error: 'Événement non trouvé' });
      return;
    }

    if (existingEvent.type !== 'MATCH') {
      res.status(400).json({ error: 'Seuls les MATCH peuvent avoir un plan de jeu' });
      return;
    }

    const event = await prisma.calendarEvent.update({
      where: { id },
      data: { gamePlan: gamePlan || null },
    });

    res.json({
      id: event.id,
      date: formatDateStr(event.date),
      startTime: event.startTime,
      endTime: event.endTime,
      type: event.type,
      title: event.title,
      description: event.description || undefined,
      gamePlan: event.gamePlan || undefined,
      createdById: event.createdById,
      createdAt: event.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('[CALENDAR] Error updating game plan:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;

