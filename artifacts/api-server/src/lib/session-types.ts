import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export interface SessionUser {
  id: number;
  name: string;
  role: string;
  site_name: string | null;
}

declare global {
  namespace Express {
    interface Request {
      currentUser?: SessionUser;
    }
  }
}
