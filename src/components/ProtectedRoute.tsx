import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import LoginPage from './LoginPage';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, checkUserAccess } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  const verifyAccess = useCallback(async () => {
    // If no user, no need to check access
    if (!user) {
      console.log('🛡️ ProtectedRoute: No user, setting access to false');
      setHasAccess(false);
      setCheckingAccess(false);
      setAccessChecked(true);
      return;
    }

    // If we're still loading auth, wait
    if (loading) {
      console.log('🛡️ ProtectedRoute: Still loading auth, waiting...');
      return;
    }

    // Prevent multiple simultaneous access checks
    if (checkingAccess) {
      console.log('🛡️ ProtectedRoute: Already checking access, skipping...');
      return;
    }

    console.log('🛡️ ProtectedRoute: Checking user access for user:', user.id);
    setCheckingAccess(true);
    
    try {
      const access = await checkUserAccess();
      console.log('🛡️ ProtectedRoute: Access check result:', access);
      setHasAccess(access);
    } catch (error) {
      console.error('🛡️ ProtectedRoute: Error checking user access:', error);
      setHasAccess(false);
    } finally {
      setCheckingAccess(false);
      setAccessChecked(true);
    }
  }, [user, loading, checkUserAccess, checkingAccess]);

  useEffect(() => {
    console.log('🛡️ ProtectedRoute: Effect triggered', { 
      user: user ? `exists (${user.id})` : 'null', 
      loading, 
      hasAccess, 
      checkingAccess,
      accessChecked 
    });
    
    verifyAccess();
  }, [user, loading, verifyAccess, hasAccess, checkingAccess, accessChecked]);

  console.log('🛡️ ProtectedRoute: Render state', { 
    user: user ? `exists (${user.id})` : 'null', 
    loading, 
    hasAccess, 
    checkingAccess,
    accessChecked,
    shouldShowLoading: loading || (user && !accessChecked),
    shouldShowLogin: !user && !loading,
    shouldShowAccessDenied: hasAccess === false && accessChecked,
    shouldShowContent: hasAccess === true && accessChecked
  });

  // Show loading if we're still loading auth OR if we have a user but haven't checked access yet
  if (loading || (user && !accessChecked)) {
    console.log('🛡️ ProtectedRoute: Showing loading screen');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-alteryx-blue mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated and not loading
  if (!user && !loading) {
    console.log('🛡️ ProtectedRoute: Showing login page');
    return <LoginPage />;
  }

  // Show access denied if user is not invited and we've checked access
  if (hasAccess === false && accessChecked) {
    console.log('🛡️ ProtectedRoute: Showing access denied');
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Access Denied
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Your account is not yet authorized to access the Alteryx Swag Portal.
            </p>
            <p className="mt-2 text-center text-sm text-gray-600">
              Please contact your administrator or wait for approval.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show content if user is authenticated and has access
  console.log('🛡️ ProtectedRoute: Showing protected content');
  return <>{children}</>;
};

export default ProtectedRoute;
