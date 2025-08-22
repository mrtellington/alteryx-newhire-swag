import { useEffect } from 'react';

// Security headers component to add CSP and other security headers
export const SecurityHeaders = () => {
  useEffect(() => {
    // Set Content Security Policy
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://emnemfewmpjczkgwzrjv.supabase.co wss://emnemfewmpjczkgwzrjv.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ');
    document.head.appendChild(meta);

    // Set X-Frame-Options (allow same origin for Lovable editor compatibility)
    const frameOptions = document.createElement('meta');
    frameOptions.httpEquiv = 'X-Frame-Options';
    frameOptions.content = 'SAMEORIGIN';
    document.head.appendChild(frameOptions);

    // Set X-Content-Type-Options
    const contentTypeOptions = document.createElement('meta');
    contentTypeOptions.httpEquiv = 'X-Content-Type-Options';
    contentTypeOptions.content = 'nosniff';
    document.head.appendChild(contentTypeOptions);

    // Set Referrer Policy
    const referrerPolicy = document.createElement('meta');
    referrerPolicy.name = 'referrer';
    referrerPolicy.content = 'strict-origin-when-cross-origin';
    document.head.appendChild(referrerPolicy);

    // Cleanup function
    return () => {
      document.head.removeChild(meta);
      document.head.removeChild(frameOptions);
      document.head.removeChild(contentTypeOptions);
      document.head.removeChild(referrerPolicy);
    };
  }, []);

  return null; // This component doesn't render anything visible
};