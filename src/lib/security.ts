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

export const secureOptionalAddressSchema = z
  .string()
  .max(100, "Address is too long")
  .transform((address) => address.trim())
  .refine((address) => {
    // Skip validation if empty
    if (!address || address.length === 0) return true;
    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<[^>]*>/g, // HTML tags
      /javascript:/i,
      /data:/i,
      /on\w+\s*=/i,
      /script/i
    ];
    return !suspiciousPatterns.some(pattern => pattern.test(address));
  }, "Address contains invalid characters")
  .optional();

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
  return emailTrimmed === 'admin@whitestonebranding.com' || 
         emailTrimmed === 'dev@whitestonebranding.com' ||
         emailTrimmed === 'cecilia@whitestonebranding.com';
}

// Session security utilities
export function generateSessionId(): string {
  return crypto.randomUUID();
}

export function initializeSecureSession(): void {
  if (!sessionStorage.getItem('session_id')) {
    sessionStorage.setItem('session_id', generateSessionId());
  }
  
  // Set session timestamp for timeout tracking
  if (!sessionStorage.getItem('session_start')) {
    sessionStorage.setItem('session_start', Date.now().toString());
  }
}

// Enhanced session management
export interface SessionInfo {
  id: string;
  startTime: number;
  lastActivity: number;
  isExpired: boolean;
  timeUntilExpiry: number;
}

export function getSessionInfo(): SessionInfo {
  const sessionId = sessionStorage.getItem('session_id') || '';
  const startTime = parseInt(sessionStorage.getItem('session_start') || '0');
  const lastActivity = parseInt(sessionStorage.getItem('last_activity') || Date.now().toString());
  const currentTime = Date.now();
  
  // 30 minutes session timeout
  const SESSION_TIMEOUT = 30 * 60 * 1000;
  const timeUntilExpiry = SESSION_TIMEOUT - (currentTime - lastActivity);
  const isExpired = timeUntilExpiry <= 0;
  
  return {
    id: sessionId,
    startTime,
    lastActivity,
    isExpired,
    timeUntilExpiry: Math.max(0, timeUntilExpiry)
  };
}

export function updateSessionActivity(): void {
  sessionStorage.setItem('last_activity', Date.now().toString());
}

export function shouldWarnSessionExpiry(): boolean {
  const sessionInfo = getSessionInfo();
  // Warn when 5 minutes remaining
  return sessionInfo.timeUntilExpiry > 0 && sessionInfo.timeUntilExpiry <= 5 * 60 * 1000;
}

export function clearSecureSession(): void {
  sessionStorage.removeItem('session_id');
  sessionStorage.removeItem('session_start');
  sessionStorage.removeItem('last_activity');
  sessionStorage.removeItem('csrf_token');
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

export function getOrCreateCSRFToken(): string {
  let token = sessionStorage.getItem('csrf_token');
  if (!token) {
    token = generateCSRFToken();
    sessionStorage.setItem('csrf_token', token);
  }
  return token;
}

// IP and Geolocation Security
export async function checkIPReputation(ip: string): Promise<boolean> {
  // Basic IP validation - in production, integrate with threat intelligence
  const privateIPRanges = [
    /^127\./,
    /^192\.168\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/
  ];
  
  // Allow private IPs (development) but log public IP checks
  if (privateIPRanges.some(range => range.test(ip))) {
    return true;
  }
  
  // In production, implement actual IP reputation checking
  // For now, just log suspicious patterns
  const suspiciousPatterns = [
    /^(tor-exit|proxy|vpn)/i,
    /^(malware|botnet|spam)/i
  ];
  
  return !suspiciousPatterns.some(pattern => pattern.test(ip));
}

// Enhanced security headers
export const getEnhancedSecurityHeaders = () => ({
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; font-src 'self' data:;"
});

// Advanced monitoring utilities
export async function logEnhancedSecurityEvent(
  eventType: string,
  metadata: Record<string, any> = {},
  severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
) {
  try {
    const sessionInfo = getSessionInfo();
    const enhancedMetadata = {
      ...metadata,
      severity,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: sessionInfo.id,
      sessionDuration: Date.now() - sessionInfo.startTime,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      cookiesEnabled: navigator.cookieEnabled,
      referrer: document.referrer || 'direct'
    };

    // Log to backend
    await logSecurityEvent(eventType, enhancedMetadata, severity);

    // For critical events, also attempt to notify immediately
    if (severity === 'critical') {
      console.warn(`CRITICAL SECURITY ALERT [${eventType}]:`, enhancedMetadata);
      
      // In production, could trigger immediate notifications
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Security Alert', {
          body: `Critical security event detected: ${eventType}`,
          icon: '/favicon.ico'
        });
      }
    }
  } catch (error) {
    console.error('Enhanced security logging error:', error);
    // Fallback to basic logging
    await logSecurityEvent(eventType, metadata, severity);
  }
}