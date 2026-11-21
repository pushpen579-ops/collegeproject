import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { getDb } from './store.ts';
import type { SafeUser, User, UserRole } from './types.ts';

const JWT_SECRET =
  process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0
    ? process.env.JWT_SECRET
    : 'fleetflow-dev-signing-secret-2026';

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
  driverId?: string;
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthPayload;
}

export function isOwnerRole(role: UserRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager';
}

export function sanitizeUser(user: User): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    driverId: user.driverId,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
  };
}

export function signToken(user: User): string {
  const payload: AuthPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    driverId: user.driverId,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  const token = header.slice('Bearer '.length).trim();
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    const db = getDb();
    const liveUser = db.users.find((u) => u.id === decoded.userId);
    if (!liveUser) {
      res.status(401).json({ error: 'Account no longer exists. Please sign in again.' });
      return;
    }

    let resolvedDriverId = liveUser.driverId ?? decoded.driverId;
    if (liveUser.role === 'driver' && !resolvedDriverId) {
      const matched = db.drivers.find(
        (d) =>
          (d.email && d.email.toLowerCase() === liveUser.email.toLowerCase()) ||
          (liveUser.phone && d.phone && d.phone.trim() === liveUser.phone.trim()),
      );
      if (matched) {
        resolvedDriverId = matched.id;
        liveUser.driverId = matched.id;
      }
    }

    req.auth = {
      userId: liveUser.id,
      email: liveUser.email,
      role: liveUser.role,
      driverId: resolvedDriverId,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Session expired or invalid token. Please sign in again.' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!roles.includes(req.auth.role)) {
      res.status(403).json({
        error: `Access denied. This action requires ${roles.join(' or ')} permissions.`,
      });
      return;
    }
    next();
  };
}
