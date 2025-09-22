import { Request, Response } from 'express';
import { startOfDay, endOfDay } from 'date-fns';
import { CashSession } from '../models/CashSession';
import { CashEntry } from '../models/CashEntry';

export const cashBoxController = {

  // Create sessions for a specific date with all configured session names
  createDailySessions: async (req: Request, res: Response) => {
    try {
      const { date, sessions } = req.body; // sessions: [{ sessionTypeId, openingAmount, notes }]
      const sessionDate = date ? new Date(date) : new Date();
      const userId = (req.user as any)?.userId;

      // Validate sessions data
      if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
        return res.status(400).json({ message: 'Sessions data is required' });
      }

      // Validate each session
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

      const { CashSessionType } = await import('../models/CashSessionType');

      const createdSessions = [];
      for (const sessionData of sessions) {
        // Get session type details
        const sessionType = await CashSessionType.findById(sessionData.sessionTypeId);
        if (!sessionType || !sessionType.isActive) {
          return res.status(400).json({ message: `Invalid or inactive session type: ${sessionData.sessionTypeId}` });
        }

        const session = await CashSession.create({
          date: sessionDate,
          sessionName: sessionType.name,
          openedBy: userId,
          openingAmount: sessionData.openingAmount,
          notes: sessionData.notes,
          status: 'open',
          openedAt: new Date(),
        });

        createdSessions.push(session);
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
      const userId = (req.user as any)?.userId;

      const session = await CashSession.findById(sessionId);
      if (!session) return res.status(404).json({ message: 'Session not found' });
      if (session.status === 'closed') return res.status(400).json({ message: 'Session already closed' });

      session.status = 'closed';
      session.closedAt = new Date();
      session.closedBy = userId;
      session.closingAmount = closingAmount;
      if (notes) session.notes = notes;
      await session.save();

      res.json({ message: 'Cash session closed', session });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to close session', error: error.message });
    }
  },


  // List sessions by date range with aggregates
  listSessions: async (req: Request, res: Response) => {
    try {
      const { 
        startDate, 
        endDate, 
        sessionType, 
        status,
        page = '1', 
        limit = '10' 
      } = req.query as { 
        startDate?: string; 
        endDate?: string; 
        sessionType?: string;
        status?: string;
        page?: string;
        limit?: string;
      };

      const start = startDate ? startOfDay(new Date(startDate)) : startOfDay(new Date());
      const end = endDate ? endOfDay(new Date(endDate)) : endOfDay(new Date());
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Build filter object
      const filter: any = {
        date: { $gte: start, $lte: end }
      };

      // Add session type filter if provided
      if (sessionType) {
        filter.sessionName = sessionType;
      }

      // Add status filter if provided
      if (status) {
        filter.status = status;
      }

      // Get total count for pagination
      const total = await CashSession.countDocuments(filter);

      // Get paginated sessions
      const sessions = await CashSession.find(filter)
        .populate('openedBy closedBy', 'firstName lastName')
        .sort({ date: -1, createdAt: -1 }) // Sort by date descending, then by creation time
        .skip(skip)
        .limit(limitNum);

      res.json({ 
        sessions, 
        total, 
        page: pageNum, 
        limit: limitNum, 
        totalPages: Math.ceil(total / limitNum) 
      });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to list sessions', error: error.message });
    }
  },

  // Get session details with net calculation
  getSessionDetails: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const session = await CashSession.findById(sessionId).populate('openedBy closedBy', 'firstName lastName');
      if (!session) return res.status(404).json({ message: 'Session not found' });

      const net = (session.closingAmount ?? 0) - session.openingAmount;

      res.json({ session, summary: { net } });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to get session details', error: error.message });
    }
  },

  // Summary for date range: totals
  summary: async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
      const start = startDate ? startOfDay(new Date(startDate)) : startOfDay(new Date());
      const end = endDate ? endOfDay(new Date(endDate)) : endOfDay(new Date());

      console.log('Summary request:', { startDate, endDate, start, end });

      // Get all sessions for the date range (including inactive/closed sessions)
      const sessions = await CashSession.find({ 
        date: { $gte: start, $lte: end } 
      }).populate('openedBy closedBy', 'firstName lastName');

      console.log('Found sessions:', sessions.length, sessions.map(s => ({
        id: s._id,
        date: s.date,
        sessionName: s.sessionName,
        openingAmount: s.openingAmount,
        closingAmount: s.closingAmount,
        status: s.status
      })));

      // Calculate net for each session first
      const sessionSummaries = sessions.map(session => {
        const sessionNet = (session.closingAmount || 0) - (session.openingAmount || 0);
        return {
          sessionId: session._id,
          sessionName: session.sessionName,
          date: session.date,
          status: session.status,
          openingAmount: session.openingAmount || 0,
          closingAmount: session.closingAmount || 0,
          net: sessionNet
        };
      });

      // Group sessions by session name and sum their nets
      const sessionGroups: { [key: string]: { totalNet: number; sessionCount: number; sessions: any[] } } = {};
      
      sessionSummaries.forEach(session => {
        if (!sessionGroups[session.sessionName]) {
          sessionGroups[session.sessionName] = {
            totalNet: 0,
            sessionCount: 0,
            sessions: []
          };
        }
        sessionGroups[session.sessionName].totalNet += session.net;
        sessionGroups[session.sessionName].sessionCount += 1;
        sessionGroups[session.sessionName].sessions.push(session);
      });

      // Convert to array format for response, sorted by session name
      const sessionBreakdown = Object.entries(sessionGroups)
        .map(([sessionName, data]) => ({
          sessionName,
          totalNet: data.totalNet,
          sessionCount: data.sessionCount,
          sessions: data.sessions
        }))
        .sort((a, b) => a.sessionName.localeCompare(b.sessionName)); // Sort alphabetically

      // Calculate total net across all sessions
      const totalNet = sessionSummaries.reduce((sum, session) => sum + session.net, 0);

      console.log('Summary calculations:', { 
        totalNet,
        sessionBreakdown: sessionBreakdown.map(s => ({ name: s.sessionName, net: s.totalNet, count: s.sessionCount }))
      });

      const response = { 
        summary: { 
          net: totalNet,
          sessionCount: sessions.length,
          sessionBreakdown 
        } 
      };

      console.log('Summary response:', response);

      res.json(response);
    } catch (error: any) {
      console.error('Summary error:', error);
      res.status(500).json({ message: 'Failed to get summary', error: error.message });
    }
  },

  // Update session opening or closing amount
  updateSession: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { openingAmount, closingAmount } = req.body;

      const session = await CashSession.findById(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      // Validate amounts
      if (openingAmount !== undefined) {
        if (typeof openingAmount !== 'number' || openingAmount < 0) {
          return res.status(400).json({ message: 'Opening amount must be a valid number >= 0' });
        }
        session.openingAmount = openingAmount;
      }

      if (closingAmount !== undefined) {
        if (typeof closingAmount !== 'number' || closingAmount < 0) {
          return res.status(400).json({ message: 'Closing amount must be a valid number >= 0' });
        }
        session.closingAmount = closingAmount;
      }

      await session.save();
      res.json({ message: 'Session updated successfully', session });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to update session', error: error.message });
    }
  },

  // Delete a cash session
  deleteSession: async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const session = await CashSession.findById(sessionId);

      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      // Delete the session
      await CashSession.deleteOne({ _id: sessionId });

      res.json({ message: 'Session deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ message: 'Failed to delete session', error: error.message });
    }
  },
};


