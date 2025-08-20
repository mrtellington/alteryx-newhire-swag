import React, { createContext, useContext, useEffect, useState } from 'react';
import { getOrCreateCSRFToken, validateCSRFToken } from '@/lib/security';

interface CSRFContextType {
  csrfToken: string;
  validateAndRefreshToken: (receivedToken: string) => boolean;
  getTokenHeaders: () => Record<string, string>;
}

const CSRFContext = createContext<CSRFContextType | null>(null);

export const useCSRF = () => {
  const context = useContext(CSRFContext);
  if (!context) {
    throw new Error('useCSRF must be used within a CSRFProvider');
  }
  return context;
};

interface CSRFProviderProps {
  children: React.ReactNode;
}

export const CSRFProvider: React.FC<CSRFProviderProps> = ({ children }) => {
  const [csrfToken, setCsrfToken] = useState<string>('');

  useEffect(() => {
    // Initialize CSRF token
    const token = getOrCreateCSRFToken();
    setCsrfToken(token);
  }, []);

  const validateAndRefreshToken = (receivedToken: string): boolean => {
    const isValid = validateCSRFToken(receivedToken, csrfToken);
    
    if (!isValid) {
      // Generate new token on validation failure
      const newToken = getOrCreateCSRFToken();
      setCsrfToken(newToken);
    }
    
    return isValid;
  };

  const getTokenHeaders = (): Record<string, string> => {
    return {
      'X-CSRF-Token': csrfToken
    };
  };

  const contextValue: CSRFContextType = {
    csrfToken,
    validateAndRefreshToken,
    getTokenHeaders
  };

  return (
    <CSRFContext.Provider value={contextValue}>
      {children}
    </CSRFContext.Provider>
  );
};

// HOC for CSRF-protected forms
interface CSRFProtectedFormProps {
  children: React.ReactNode;
  onSubmit: (event: React.FormEvent, csrfToken: string) => void;
  className?: string;
}

export const CSRFProtectedForm: React.FC<CSRFProtectedFormProps> = ({
  children,
  onSubmit,
  className
}) => {
  const { csrfToken } = useCSRF();

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit(event, csrfToken);
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      <input type="hidden" name="_csrf" value={csrfToken} />
      {children}
    </form>
  );
};