// Calendar routes - HTTP protocol only, business logic in services

import { Router } from 'express';
import type { Response } from 'express';
import { authMiddleware, requirePermission } from '@middleware/auth.middleware';
import type { AuthRequest } from '@middleware/auth.middleware';
import type { SetAvailabilityRequest, CreateEventRequest } from '@shared/types';
import { ERROR } from '@shared/constants';
import { apiLogger } from '@utils/logger';
import * as calendarService from '@services/calendar.service';

const router = Router();

// ============================================
// Availability Routes
// ============================================

// GET /api/calendar/availability?month=YYYY-MM
router.get('/availability', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { month } = req.query;
  const teamId = req.account?.teamId;
  const playerId = req.account?.playerId;

  if (!calendarService.isValidMonth(month)) {
    res.status(400).json({ errors: [ERROR.monthParamRequired] });
    return;
  }

  if (!teamId) {
    res.status(403).json({ errors: [ERROR.teamRequiredForCalendar] });
    return;
  }

  try {
    const result = await calendarService.getMonthAvailability(month, teamId, playerId!);
    res.json(result);
  } catch (error) {
    apiLogger.error('Error fetching availability:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// POST /api/calendar/availability
router.post('/availability', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { date, status } = req.body as SetAvailabilityRequest;
  const playerId = req.account!.playerId!;

  if (!calendarService.isValidDate(date)) {
    res.status(400).json({ errors: [ERROR.dateInvalid] });
    return;
  }

  if (!calendarService.isValidAvailabilityStatus(status)) {
    res.status(400).json({ errors: [ERROR.statusInvalid] });
    return;
  }

  try {
    const result = await calendarService.setAvailability(playerId, date, status);

    if (result.deleted) {
      res.json({ success: true, deleted: true });
    } else {
      res.json(result.availability);
    }
  } catch (error) {
    apiLogger.error('Error setting availability:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// ============================================
// Event Routes
// ============================================

// GET /api/calendar/events?month=YYYY-MM
router.get('/events', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { month } = req.query;
  const teamId = req.account?.teamId;

  if (!calendarService.isValidMonth(month)) {
    res.status(400).json({ errors: [ERROR.monthParamRequired] });
    return;
  }

  if (!teamId) {
    res.status(403).json({ errors: [ERROR.teamRequiredForCalendar] });
    return;
  }

  try {
    const events = await calendarService.getMonthEvents(month, teamId);
    res.json(events);
  } catch (error) {
    apiLogger.error('Error fetching events:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// POST /api/calendar/events
router.post('/events', authMiddleware, requirePermission('calendar', 'canCreateEvents'), async (req: AuthRequest, res: Response) => {
  const { date, startTime, endTime, type, title, description } = req.body as CreateEventRequest;
  const createdByAccountId = req.account!.userId;
  const teamId = req.account?.teamId;

  if (!teamId) {
    res.status(400).json({ errors: [ERROR.teamRequiredForEvents] });
    return;
  }

  // Validation
  if (!calendarService.isValidDate(date)) {
    res.status(400).json({ errors: [ERROR.dateInvalid] });
    return;
  }
  if (!calendarService.isValidTime(startTime)) {
    res.status(400).json({ errors: [ERROR.startTimeInvalid] });
    return;
  }
  if (!calendarService.isValidTime(endTime)) {
    res.status(400).json({ errors: [ERROR.endTimeInvalid] });
    return;
  }
  if (!calendarService.isValidEventType(type)) {
    res.status(400).json({ errors: [ERROR.eventTypeInvalid] });
    return;
  }
  if (!title || !title.trim()) {
    res.status(400).json({ errors: [ERROR.titleRequired] });
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
      createdByUserId: createdByAccountId,
    });

    res.status(201).json(event);
  } catch (error) {
    apiLogger.error('Error creating event:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// DELETE /api/calendar/events/:id
router.delete('/events/:id', authMiddleware, requirePermission('calendar', 'canDeleteEvents'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const teamId = req.account?.teamId;

  try {
    const result = await calendarService.getEventWithTeamCheck(id, teamId || undefined);

    if ('notFound' in result) {
      res.status(404).json({ errors: [ERROR.eventNotFound] });
      return;
    }

    if ('accessDenied' in result) {
      res.status(403).json({ errors: [ERROR.accessDenied] });
      return;
    }

    await calendarService.deleteEvent(id);
    res.json({ success: true });
  } catch (error) {
    apiLogger.error('Error deleting event:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// PUT /api/calendar/events/:id
router.put('/events/:id', authMiddleware, requirePermission('calendar', 'canEditEvents'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { date, startTime, endTime, type, title, description } = req.body as CreateEventRequest;
  const teamId = req.account?.teamId;

  // Validation
  if (date && !calendarService.isValidDate(date)) {
    res.status(400).json({ errors: [ERROR.dateInvalid] });
    return;
  }
  if (startTime && !calendarService.isValidTime(startTime)) {
    res.status(400).json({ errors: [ERROR.startTimeInvalid] });
    return;
  }
  if (endTime && !calendarService.isValidTime(endTime)) {
    res.status(400).json({ errors: [ERROR.endTimeInvalid] });
    return;
  }
  if (type && !calendarService.isValidEventType(type)) {
    res.status(400).json({ errors: [ERROR.eventTypeInvalid] });
    return;
  }

  try {
    const result = await calendarService.getEventWithTeamCheck(id, teamId || undefined);

    if ('notFound' in result) {
      res.status(404).json({ errors: [ERROR.eventNotFound] });
      return;
    }

    if ('accessDenied' in result) {
      res.status(403).json({ errors: [ERROR.accessDenied] });
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
    apiLogger.error('Error updating event:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

// PUT /api/calendar/events/:id/gameplan
router.put('/events/:id/gameplan', authMiddleware, requirePermission('calendar', 'canAttachGamePlan'), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { gamePlan } = req.body;
  const teamId = req.account?.teamId;

  try {
    const result = await calendarService.getEventWithTeamCheck(id, teamId || undefined);

    if ('notFound' in result) {
      res.status(404).json({ errors: [ERROR.eventNotFound] });
      return;
    }

    if ('accessDenied' in result) {
      res.status(403).json({ errors: [ERROR.accessDenied] });
      return;
    }

    if (result.event.type !== 'MATCH') {
      res.status(400).json({ errors: [ERROR.matchOnlyGamePlan] });
      return;
    }

    const event = await calendarService.updateEventGamePlan(id, gamePlan);
    res.json(event);
  } catch (error) {
    apiLogger.error('Error updating game plan:', error);
    res.status(500).json({ errors: [ERROR.serverError] });
  }
});

export default router;

