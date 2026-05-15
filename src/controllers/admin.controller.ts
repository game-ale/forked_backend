import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

/**
 * Retrieves a list of all registered users in the system.
 * Only accessible by administrators.
 */
export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!prisma) {
      throw new Error('Database is not configured.');
    }

    // Fetch all user profiles from the database, ordering by creation date
    const users = await prisma.userProfile.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      message: 'Users retrieved successfully',
      data: users,
    });
  } catch (error) {
    next(error);
  }
};
