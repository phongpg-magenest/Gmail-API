import type { NextFunction, Request, Response } from 'express'
import { findUserById } from './demoUser'

declare global {
  namespace Express {
    interface Request {
      sessionUser?: {
        id: number
        email: string
      }
    }
  }
}

export function attachSessionUser(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const user = findUserById(1)
  if (user) {
    req.sessionUser = { id: user.id, email: user.email }
  }
  next()
}

export function requireSession(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.sessionUser) {
    res.status(401).json({ error: 'Not authenticated' })
    return
  }

  next()
}
