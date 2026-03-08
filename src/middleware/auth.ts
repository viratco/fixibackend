import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
    id: string;
    role: 'user' | 'worker';
    phone: string;
}

// Extend Express Request to carry decoded JWT
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
        req.user = decoded;
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

export function workerAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
    authMiddleware(req, res, () => {
        if (req.user?.role !== 'worker') {
            res.status(403).json({ error: 'Worker access only' });
            return;
        }
        next();
    });
}
