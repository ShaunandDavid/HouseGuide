import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

// Enhanced security utilities
export class SecurityUtils {
  // Generate cryptographically secure random tokens
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  // Hash sensitive data with salt
  static async hashData(data: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  // Verify hashed data
  static async verifyHash(data: string, hashedData: string): Promise<boolean> {
    const [salt, hash] = hashedData.split(':');
    const verifyHash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }

  // Sanitize user input to prevent XSS
  static sanitizeInput(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // Validate email format
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  // Validate password strength
  static validatePasswordStrength(password: string): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Generate secure session ID
  static generateSessionId(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  // Content Security Policy headers
  static getCSPHeaders(): Record<string, string> {
    return {
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https: blob:",
        "connect-src 'self' https://api.openai.com",
        "frame-ancestors 'none'",
        "form-action 'self'"
      ].join('; ')
    };
  }

  // SQL injection prevention
  static escapeSQLString(str: string): string {
    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, (char) => {
      switch (char) {
        case "\0": return "\\0";
        case "\x08": return "\\b";
        case "\x09": return "\\t";
        case "\x1a": return "\\z";
        case "\n": return "\\n";
        case "\r": return "\\r";
        case "\"":
        case "'":
        case "\\":
        case "%": return "\\" + char;
        default: return char;
      }
    });
  }

  // File upload validation
  static validateFileUpload(file: Express.Multer.File): {
    valid: boolean;
    error?: string;
  } {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'text/plain'
    ];

    if (file.size > maxSize) {
      return { valid: false, error: 'File size exceeds 10MB limit' };
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return { valid: false, error: 'Invalid file type' };
    }

    // Check file extension matches MIME type
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    const expectedExtensions: Record<string, string[]> = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
      'image/gif': ['gif'],
      'image/webp': ['webp'],
      'application/pdf': ['pdf'],
      'text/plain': ['txt']
    };

    const validExtensions = expectedExtensions[file.mimetype];
    if (!extension || !validExtensions?.includes(extension)) {
      return { valid: false, error: 'File extension does not match MIME type' };
    }

    return { valid: true };
  }
}

// Security middleware
export const securityMiddleware = {
  // Prevent timing attacks on string comparison
  constantTimeCompare: (a: string, b: string): boolean => {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  },

  // Add security headers
  addSecurityHeaders: (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    const cspHeaders = SecurityUtils.getCSPHeaders();
    Object.entries(cspHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    
    next();
  },

  // Validate API key
  validateAPIKey: (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(401).json({ error: 'API key required' });
    }

    // In production, validate against stored API keys
    if (process.env.NODE_ENV === 'production') {
      // Implement API key validation logic
      // This is a placeholder - implement actual validation
      const isValid = true; // Replace with actual validation
      
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid API key' });
      }
    }

    next();
  },

  // Audit logging
  auditLog: (action: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
      const logEntry = {
        timestamp: new Date().toISOString(),
        action,
        user: (req as any).guide?.email || 'anonymous',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        path: req.path,
        method: req.method,
        body: req.method !== 'GET' ? { ...req.body, password: '[REDACTED]' } : undefined
      };

      // In production, send to logging service
      if (process.env.NODE_ENV === 'production') {
        console.log('AUDIT:', JSON.stringify(logEntry));
      }

      next();
    };
  }
};