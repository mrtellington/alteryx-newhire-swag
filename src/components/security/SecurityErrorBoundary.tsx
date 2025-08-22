import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logEnhancedSecurityEvent, clearSecureSession } from '@/lib/security';

interface SecurityErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface SecurityErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
}

export class SecurityErrorBoundary extends React.Component<
  SecurityErrorBoundaryProps,
  SecurityErrorBoundaryState
> {
  constructor(props: SecurityErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): SecurityErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });

    // Log security-relevant errors
    const isSecurityError = this.isSecurityRelevantError(error);
    
    logEnhancedSecurityEvent(
      'application_error',
      {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        isSecurityRelevant: isSecurityError,
        url: window.location.href,
        userAgent: navigator.userAgent,
      },
      isSecurityError ? 'high' : 'medium'
    );

    // Clear session for security errors
    if (isSecurityError) {
      clearSecureSession();
    }
  }

  private isSecurityRelevantError(error: Error): boolean {
    const securityKeywords = [
      'auth',
      'token',
      'session',
      'permission',
      'unauthorized',
      'forbidden',
      'csrf',
      'xss',
      'injection',
      'security',
    ];

    const errorMessage = error.message.toLowerCase();
    const errorStack = (error.stack || '').toLowerCase();

    return securityKeywords.some(
      keyword => errorMessage.includes(keyword) || errorStack.includes(keyword)
    );
  }

  private resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  private handleReload = () => {
    clearSecureSession();
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const { error } = this.state;
      const isSecurityError = error && this.isSecurityRelevantError(error);

      if (this.props.fallback) {
        return <this.props.fallback error={error!} resetError={this.resetError} />;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full space-y-4">
            <Alert variant={isSecurityError ? "destructive" : "default"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {isSecurityError ? 'Security Error Detected' : 'Application Error'}
              </AlertTitle>
              <AlertDescription className="space-y-4">
                <p>
                  {isSecurityError 
                    ? 'A security-related error has occurred. For your protection, your session has been cleared.'
                    : 'An unexpected error has occurred. Please try refreshing the page.'
                  }
                </p>
                
                {process.env.NODE_ENV === 'development' && error && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-medium">
                      Error Details
                    </summary>
                    <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto">
                      {error.message}
                      {error.stack && `\n\nStack trace:\n${error.stack}`}
                    </pre>
                  </details>
                )}

                <div className="flex space-x-2">
                  <Button onClick={this.resetError} variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                  <Button onClick={this.handleReload} size="sm">
                    Reload Page
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}