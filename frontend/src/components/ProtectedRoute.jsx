import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '../api';

const ProtectedRoute = ({ children, requiredRole = null }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(null);
    const [userRole, setUserRole] = useState(null);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const token = localStorage.getItem('token');

        if (!token) {
            setIsAuthenticated(false);
            return;
        }

        try {
            // Verify token by fetching user info
            const response = await api.get('users/me/');
            setUserRole(response.data.role);
            setIsAuthenticated(true);

            // Store user info
            localStorage.setItem('userRole', response.data.role);
            localStorage.setItem('userId', response.data.id);
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('token');
            localStorage.removeItem('userRole');
            localStorage.removeItem('userId');
            setIsAuthenticated(false);
        }
    };

    // Loading state
    if (isAuthenticated === null) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    // Not authenticated
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Check role-based access
    if (requiredRole && userRole !== requiredRole) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
};

export default ProtectedRoute;
