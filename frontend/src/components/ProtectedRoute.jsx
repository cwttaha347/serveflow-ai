import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../api';
import { getDraft, markResumeAfterAuth } from '../utils/chatbotDraft';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requiredRole = null }) => {
    const { user, loading, logout } = useAuth();
    const location = useLocation();

    // The logic below relies on the user provided by AuthContext.
    // AuthContext already handles the 'users/me/' fetch globally.

    // Loading state
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    <p className="text-sm font-bold text-slate-500 animate-pulse uppercase tracking-widest">Verifying Comms...</p>
                </div>
            </div>
        );
    }

    // Not authenticated
    if (!user) {
        if (getDraft()) {
            markResumeAfterAuth();
        }
        return <Navigate to="/login" replace />;
    }

    const emailVerified = user.is_email_verified !== false;
    if (!emailVerified && user.role !== 'admin') {
        return <Navigate to="/verify-otp" state={{ email: user.email || '' }} replace />;
    }

    const providerOnboardingRequired = user.role === 'provider' && user.provider_onboarding_required === true;
    if (providerOnboardingRequired && !location.pathname.startsWith('/provider-onboarding')) {
        return <Navigate to="/provider-onboarding" replace />;
    }

    const profileCompleted = user.profile_completed !== false;
    if (!profileCompleted && !location.pathname.startsWith('/dashboard/settings') && !location.pathname.startsWith('/provider-onboarding')) {
        return <Navigate to="/dashboard/settings?onboarding=1" replace />;
    }

    // Check role-based access
    if (requiredRole && user.role !== requiredRole) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};

export default ProtectedRoute;
