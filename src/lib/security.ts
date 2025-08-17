import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

// Enhanced input validation schemas
export const secureEmailSchema = z
  .string()
  .email("Please enter a valid email address")
  .min(5, "Email must be at least 5 characters")
  .max(254, "Email must be less than 254 characters")
  .transform((email) => email.toLowerCase().trim())
  .refine((email) => {
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /javascript:/i,
      /<script/i,
      /data:/i,
      /vbscript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /expression\s*\(/i
    ];
    return !suspiciousPatterns.some(pattern => pattern.test(email));
  }, "Email contains invalid characters");

export const secureNameSchema = z
  .string()
  .min(1, "Name is required")
  .max(50, "Name must be less than 50 characters")
  .regex(/^[a-zA-Z\s\-'\.]+$/, "Name can only contain letters, spaces, hyphens, apostrophes, and periods")
  .transform((name) => name.trim())
  .refine((name) => {
    // Additional security checks
    const suspiciousPatterns = [
      /<[^>]*>/g, // HTML tags
      /javascript:/i,
      /data:/i,
      /on\w+\s*=/i
    ];
    return !suspiciousPatterns.some(pattern => pattern.test(name));
  }, "Name contains invalid characters");

export const securePhoneSchema = z
  .string()
  .min(7, "Phone number is required")
  .max(25, "Phone number is too long")
  .regex(/^[+]?[-().\s\d]{7,25}$/, "Enter a valid phone number")
  .transform((phone) => phone.trim())
  .refine((phone) => {
    // Remove suspicious characters
    const cleanPhone = phone.replace(/[^\d+\-().\s]/g, '');
    return cleanPhone.length >= 7;
  }, "Phone number contains invalid characters");

export const secureAddressSchema = z
  .string()
  .min(3, "Address is required")
  .max(100, "Address is too long")
  .transform((address) => address.trim())
  .refine((address) => {
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<[^>]*>/g, // HTML tags
      /javascript:/i,
      /data:/i,
      /on\w+\s*=/i,
      /script/i
    ];
    return !suspiciousPatterns.some(pattern => pattern.test(address));
  }, "Address contains invalid characters");

// Rate limiting utilities
export class RateLimiter {
  private attempts: Map<string, { count: number; lastAttempt: number }> = new Map();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts = 5, windowMs = 15 * 60 * 1000) { // 5 attempts per 15 minutes
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  checkRateLimit(identifier: string): { allowed: boolean; remainingTime?: number } {
    const now = Date.now();
    const attemptData = this.attempts.get(identifier);

    if (!attemptData) {
      this.attempts.set(identifier, { count: 1, lastAttempt: now });
      return { allowed: true };
    }

    // Reset if window has passed
    if (now - attemptData.lastAttempt > this.windowMs) {
      this.attempts.set(identifier, { count: 1, lastAttempt: now });
      return { allowed: true };
    }

    // Check if limit exceeded
    if (attemptData.count >= this.maxAttempts) {
      const remainingTime = this.windowMs - (now - attemptData.lastAttempt);
      return { allowed: false, remainingTime };
    }

    // Increment count
    attemptData.count++;
    attemptData.lastAttempt = now;
    return { allowed: true };
  }

  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }
}

// Security event logging with enhanced details
export async function logSecurityEvent(
  eventType: string, 
  metadata: Record<string, any> = {},
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
) {
  try {
    const enhancedMetadata = {
      ...metadata,
      severity,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: sessionStorage.getItem('session_id') || 'unknown'
    };

    const { error } = await supabase.rpc('log_security_event', {
      event_type: eventType,
      metadata: enhancedMetadata
    });

    if (error) {
      console.error('Failed to log security event:', error);
    }

    // For critical events, also log to console for immediate visibility
    if (severity === 'critical') {
      console.warn(`SECURITY ALERT [${eventType}]:`, enhancedMetadata);
    }
  } catch (error) {
    console.error('Security logging error:', error);
  }
}

// Input sanitization utilities
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .slice(0, 1000); // Limit length
}

// Email domain validation
export function isAllowedEmailDomain(email: string): boolean {
  const emailTrimmed = email.trim().toLowerCase();
  return emailTrimmed === 'tod.ellington@gmail.com' || 
         /@(?:alteryx\.com|whitestonebranding\.com)$/i.test(emailTrimmed);
}

// Admin email validation
export function isValidAdminEmail(email: string): boolean {
  const emailTrimmed = email.trim().toLowerCase();
  return emailTrimmed === 'admin@whitestonebranding.com' || emailTrimmed === 'dev@whitestonebranding.com';
}

// Session security utilities
export function generateSessionId(): string {
  return crypto.randomUUID();
}

export function initializeSecureSession(): void {
  if (!sessionStorage.getItem('session_id')) {
    sessionStorage.setItem('session_id', generateSessionId());
  }
}

// Content Security Policy helpers
export function validateFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type);
}

export function validateFileSize(file: File, maxSizeBytes: number): boolean {
  return file.size <= maxSizeBytes;
}

// CSRF protection
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function validateCSRFToken(token: string, storedToken: string): boolean {
  return token === storedToken && token.length === 64;
}