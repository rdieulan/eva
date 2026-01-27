// Calendar routes - HTTP protocol only, business logic in services

import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import type { SetAvailabilityRequest, CreateEventRequest } from '@shared/types';
import * as calendarService from '@services/calendar.service';

const router = Router();

// ============================================
// Availability Routes
// ============================================

// GET /api/calendar/availability?month=YYYY-MM
router.get('/availability', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { month } = req.query;
  const teamId = req.user?.teamId;
  const userId = req.user?.userId;

  if (!calendarService.isValidMonth(month)) {
    res.status(400).json({ errors: ['Paramètre month requis (format YYYY-MM)'] });
    return;
  }

  // User must belong to a team to see availabilities
  if (!teamId) {
    console.log('[CALENDAR] User without team, returning empty data');
    res.json(calendarService.buildEmptyCalendar(month));
    return;
  }

  try {
    const result = await calendarService.getMonthAvailability(month, teamId, userId!);
    res.json(result);
  } catch (error) {
    console.error('[CALENDAR] Error fetching availability:', error);
    res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

// POST /api/calendar/availability
router.post('/availability', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { date, status } = req.body as SetAvailabilityRequest;
  const userId = req.user!.userId;

  if (!calendarService.isValidDate(date)) {
    res.status(400).json({ errors: ['Date invalide (format YYYY-MM-DD requis)'] });
    return;
  }

  if (!calendarService.isValidAvailabilityStatus(status)) {
    res.status(400).json({ errors: ['Status invalide'] });
    return;
  }

  try {
    const result = await calendarService.setAvailability(userId, date, status);

    if (result.deleted) {
      res.json({ success: true, deleted: true });
    } else {
      res.json(result.availability);
    }
  } catch (error) {
    console.error('[CALENDAR] Error setting availability:', error);
    res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

// ============================================
// Event Routes
// ============================================

// GET /api/calendar/events?month=YYYY-MM
router.get('/events', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { month } = req.query;
  const teamId = req.user?.teamId;

  if (!calendarService.isValidMonth(month)) {
    res.status(400).json({ errors: ['Paramètre month requis (format YYYY-MM)'] });
    return;
  }

  if (!teamId) {
    res.json([]);
    return;
  }

  try {
    const events = await calendarService.getMonthEvents(month, teamId);
    res.json(events);
  } catch (error) {
    console.error('[CALENDAR] Error fetching events:', error);
    res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

// POST /api/calendar/events
router.post('/events', authMiddleware, requirePermission('calendar', 'canCreateEvents'), async (req: AuthRequest, res: Response) => {
  const { date, startTime, endTime, type, title, description } = req.body as CreateEventRequest;
  const createdById = req.user!.userId;
  const teamId = req.user?.teamId;

  if (!teamId) {
    res.status(400).json({ errors: ['User must belong to a team to create events'] });
    return;
  }

  // Validation
  if (!calendarService.isValidDate(date)) {
    res.status(400).json({ errors: ['Date invalide (format YYYY-MM-DD requis)'] });
    return;
  }
  if (!calendarService.isValidTime(startTime)) {
    res.status(400).json({ errors: ['Heure de début invalide (format HH:mm requis)'] });
    return;
  }
  if (!calendarService.isValidTime(endTime)) {
    res.status(400).json({ errors: ['Heure de fin invalide (format HH:mm requis)'] });
    return;
  }
  if (!calendarService.isValidEventType(type)) {
    res.status(400).json({ errors: ['Type invalide (MATCH ou EVENT requis)'] });
    return;
  }
  if (!title || !title.trim()) {
    res.status(400).json({ errors: ['Titre requis'] });
    return;
  }

  try {
    const event = await calendarService.createEvent({
      date,
      startTime,
      endTime,
      type,
      title,
      description,
      teamId,
      createdById,
    });

    res.status(201).json(event);
  } catch (error) {
    console.error('[CALENDAR] Error creating event:', error);
    res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

// DELETE /api/calendar/events/:id
router.delete('/events/:id', authMiddleware, requirePermission('calendar', 'canDeleteEvents'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const teamId = req.user?.teamId;

  try {
    const result = await calendarService.getEventWithTeamCheck(id, teamId || undefined);

    if ('notFound' in result) {
      res.status(404).json({ errors: ['Événement non trouvé'] });
      return;
    }

    if ('accessDenied' in result) {
      res.status(403).json({ errors: ['Accès refusé'] });
      return;
    }

    await calendarService.deleteEvent(id);
    res.json({ success: true });
  } catch (error) {
    console.error('[CALENDAR] Error deleting event:', error);
    res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

// PUT /api/calendar/events/:id
router.put('/events/:id', authMiddleware, requirePermission('calendar', 'canEditEvents'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { date, startTime, endTime, type, title, description } = req.body as CreateEventRequest;
  const teamId = req.user?.teamId;

  // Validation
  if (date && !calendarService.isValidDate(date)) {
    res.status(400).json({ errors: ['Date invalide (format YYYY-MM-DD requis)'] });
    return;
  }
  if (startTime && !calendarService.isValidTime(startTime)) {
    res.status(400).json({ errors: ['Heure de début invalide (format HH:mm requis)'] });
    return;
  }
  if (endTime && !calendarService.isValidTime(endTime)) {
    res.status(400).json({ errors: ['Heure de fin invalide (format HH:mm requis)'] });
    return;
  }
  if (type && !calendarService.isValidEventType(type)) {
    res.status(400).json({ errors: ['Type invalide (MATCH ou EVENT requis)'] });
    return;
  }

  try {
    const result = await calendarService.getEventWithTeamCheck(id, teamId || undefined);

    if ('notFound' in result) {
      res.status(404).json({ errors: ['Événement non trouvé'] });
      return;
    }

    if ('accessDenied' in result) {
      res.status(403).json({ errors: ['Accès refusé'] });
      return;
    }

    const event = await calendarService.updateEvent(id, {
      date,
      startTime,
      endTime,
      type,
      title,
      description,
    });

    res.json(event);
  } catch (error) {
    console.error('[CALENDAR] Error updating event:', error);
    res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

// PUT /api/calendar/events/:id/gameplan
router.put('/events/:id/gameplan', authMiddleware, requirePermission('calendar', 'canAttachGamePlan'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { gamePlan } = req.body;
  const teamId = req.user?.teamId;

  try {
    const result = await calendarService.getEventWithTeamCheck(id, teamId || undefined);

    if ('notFound' in result) {
      res.status(404).json({ errors: ['Événement non trouvé'] });
      return;
    }

    if ('accessDenied' in result) {
      res.status(403).json({ errors: ['Accès refusé'] });
      return;
    }

    if (result.event.type !== 'MATCH') {
      res.status(400).json({ errors: ['Seuls les MATCH peuvent avoir un plan de jeu'] });
      return;
    }

    const event = await calendarService.updateEventGamePlan(id, gamePlan);
    res.json(event);
  } catch (error) {
    console.error('[CALENDAR] Error updating game plan:', error);
    res.status(500).json({ errors: ['Erreur serveur'] });
  }
});

export default router;

