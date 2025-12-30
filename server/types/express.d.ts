import type { Guide } from "@shared/schema";

declare global {
  namespace Express {
    interface Request {
      guide: Guide & {
        orgId?: string;
        role?: string;
        houseId?: string;
      };
    }
  }
}

export {};
