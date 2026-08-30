import { Request, Response } from 'express';
import { startOfDay, endOfDay } from 'date-fns';
import { prisma } from '../config/prisma';
import { formatDoc, formatDocs } from '../utils/format';

export const cashBoxController = {
  // Create sessions for a specific date
  createDailySessions: async (req: Request, res: Response) => {
    try {
      const { date, sessions } = req.body;
      const sessionDate = date ? new Date(date) : new Date();
      const userId = (req.user as any)?.userId || (req.user as any)?._id || (req.user as any)?.id;

      if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
        return res.status(400).json({ message: 'Sessions data is required' });
      }

      for (const sessionData of sessions) {
        if (!sessionData.sessionTypeId) {
          return res.status(400).json({ message: 'Session type ID is required for all sessions' });
        }
        if (sessionData.openingAmount === undefined || sessionData.openingAmount === null || sessionData.openingAmount === '') {
          return res.status(400).json({ message: 'Opening amount is required for all sessions (can be 0)' });
        }
        if (typeof sessionData.openingAmount !== 'number' || sessionData.openingAmount < 0) {
          return res.status(400).json({ message: 'Opening amount must be a valid number >= 0' });
        }
      }

      const createdSessions = [];
      for (const sessionData of sessions) {
        const sessionType = await prisma.cashSessionType.findUnique({
          where: { id: sessionData.sessionTypeId },
        });
        if (!sessionType || !sessionType.isActive) {
          return res.status(400).json({ message: `Invalid or inactive session type: ${sessionData.sessionTypeId}` });
        }

        const session = await prisma.cashSession.create({
          data: {
            date: sessionDate,
            sessionName: sessionType.name,
            openedById: userId,
            openingAmount: sessionData.openingAmount,
            notes: sessionData.notes || null,
            status: 'open',
            openedAt: new Date(),
          },
          include: {
            openedBy: { select: { id: true, firstName: true, lastName: true } },
          },
        });

        createdSessions.push(formatDoc(session));
      }

      res.json({ message: 'Daily sessions created', sessions: createdSessions });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to create daily sessions', error: error.message });
    }
  },

  // Close an existing session
  closeSession: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { closingAmount, notes } = req.body;
      const userId = (req.user as any)?.userId || (req.user as any)?._id || (req.user as any)?.id;

      const session = await prisma.cashSession.findUnique({ where: { id: sessionId } });
      if (!session) return res.status(404).json({ message: 'Session not found' });
      if (session.status === 'closed') return res.status(400).json({ message: 'Session already closed' });

      const updated = await prisma.cashSession.update({
        where: { id: sessionId },
        data: {
          status: 'closed',
          closedAt: new Date(),
          closedById: userId,
          closingAmount: Number(closingAmount),
          notes: notes || session.notes,
        },
        include: {
          openedBy: { select: { id: true, firstName: true, lastName: true } },
          closedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      res.json({ message: 'Cash session closed', session: formatDoc(updated) });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to close session', error: error.message });
    }
  },

  // Update session
  updateSession: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { openingAmount, closingAmount, notes, sessionName, status } = req.body;

      const session = await prisma.cashSession.update({
        where: { id: sessionId },
        data: {
          openingAmount: openingAmount !== undefined ? Number(openingAmount) : undefined,
          closingAmount: closingAmount !== undefined ? Number(closingAmount) : undefined,
          notes: notes !== undefined ? notes : undefined,
          sessionName: sessionName !== undefined ? sessionName : undefined,
          status: status !== undefined ? status : undefined,
        },
        include: {
          openedBy: { select: { id: true, firstName: true, lastName: true } },
          closedBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      res.json({ message: 'Cash session updated', session: formatDoc(session) });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to update session', error: error.message });
    }
  },

  // Delete session
  deleteSession: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      await prisma.cashEntry.deleteMany({ where: { sessionId } });
      await prisma.cashSession.delete({ where: { id: sessionId } });
      res.json({ message: 'Cash session deleted' });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to delete session', error: error.message });
    }
  },

  // List sessions by date range
  listSessions: async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, sessionType, status, page = '1', limit = '10' } = req.query as any;

      const start = startDate ? startOfDay(new Date(startDate)) : startOfDay(new Date());
      const end = endDate ? endOfDay(new Date(endDate)) : endOfDay(new Date());
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {
        date: { gte: start, lte: end },
      };

      if (sessionType) where.sessionName = sessionType;
      if (status) where.status = status;

      const [sessions, total] = await Promise.all([
        prisma.cashSession.findMany({
          where,
          include: {
            openedBy: { select: { id: true, firstName: true, lastName: true } },
            closedBy: { select: { id: true, firstName: true, lastName: true } },
            entries: true,
          },
          orderBy: { date: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.cashSession.count({ where }),
      ]);

      const formatted = sessions.map((s) => ({
        ...s,
        _id: s.id,
        openedBy: formatDoc(s.openedBy),
        closedBy: formatDoc(s.closedBy),
        entries: formatDocs(s.entries),
      }));

      res.json({
        sessions: formatted,
        pagination: {
          current: pageNum,
          pages: Math.ceil(total / limitNum),
          total,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to list sessions', error: error.message });
    }
  },

  // Get session details
  getSessionDetails: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const session = await prisma.cashSession.findUnique({
        where: { id: sessionId },
        include: {
          openedBy: { select: { id: true, firstName: true, lastName: true } },
          closedBy: { select: { id: true, firstName: true, lastName: true } },
          entries: {
            include: {
              createdBy: { select: { id: true, firstName: true, lastName: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!session) return res.status(404).json({ message: 'Session not found' });

      res.json({
        session: {
          ...session,
          _id: session.id,
          openedBy: formatDoc(session.openedBy),
          closedBy: formatDoc(session.closedBy),
          entries: session.entries.map((e) => ({
            ...e,
            _id: e.id,
            createdBy: formatDoc(e.createdBy),
          })),
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to get session details', error: error.message });
    }
  },

  // Add cash entry
  addEntry: async (req: Request, res: Response) => {
    try {
      const { sessionId, type, amount, description } = req.body;
      const userId = (req.user as any)?.userId || (req.user as any)?._id || (req.user as any)?.id;

      if (!sessionId || !type || amount === undefined) {
        return res.status(400).json({ message: 'Session ID, type, and amount are required' });
      }

      const session = await prisma.cashSession.findUnique({ where: { id: sessionId } });
      if (!session) return res.status(404).json({ message: 'Session not found' });
      if (session.status === 'closed') return res.status(400).json({ message: 'Cannot add entry to a closed session' });

      const entry = await prisma.cashEntry.create({
        data: {
          sessionId,
          type: type as any,
          amount: Number(amount),
          description: description?.trim() || null,
          createdById: userId,
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      res.status(201).json({
        message: 'Cash entry added',
        entry: {
          ...entry,
          _id: entry.id,
          createdBy: formatDoc(entry.createdBy),
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to add cash entry', error: error.message });
    }
  },

  // List entries for a session
  listEntries: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const entries = await prisma.cashEntry.findMany({
        where: { sessionId },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        entries: entries.map((e) => ({
          ...e,
          _id: e.id,
          createdBy: formatDoc(e.createdBy),
        })),
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to list cash entries', error: error.message });
    }
  },

  // Summary
  summary: async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      const start = startDate ? startOfDay(new Date(startDate)) : startOfDay(new Date());
      const end = endDate ? endOfDay(new Date(endDate)) : endOfDay(new Date());

      const sessions = await prisma.cashSession.findMany({
        where: { date: { gte: start, lte: end } },
        include: { entries: true },
      });

      let totalOpening = 0;
      let totalClosing = 0;
      let totalCashIn = 0;
      let totalCashOut = 0;

      for (const s of sessions) {
        totalOpening += s.openingAmount || 0;
        totalClosing += s.closingAmount || 0;
        for (const e of s.entries) {
          if (e.type === 'in') totalCashIn += e.amount;
          if (e.type === 'out') totalCashOut += e.amount;
        }
      }

      res.json({
        summary: {
          sessionCount: sessions.length,
          totalOpening,
          totalClosing,
          totalCashIn,
          totalCashOut,
          netCashFlow: totalCashIn - totalCashOut,
        },
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to get cash summary', error: error.message });
    }
  },
};
