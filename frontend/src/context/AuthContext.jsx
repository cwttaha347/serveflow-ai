import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [role, setRole] = useState(localStorage.getItem('userRole'));
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const checkAuth = async () => {
            if (token) {
                try {
                    const me = await api.get('users/me/');
                    const meData = me.data || {};
                    setRole(meData.role || localStorage.getItem('userRole') || null);
                    setUser({
                        id: meData.id,
                        role: meData.role,
                        email: meData.email,
                        is_email_verified: Boolean(meData.is_email_verified),
                    });
                    localStorage.setItem('userRole', meData.role || '');
                    localStorage.setItem('userId', String(meData.id || ''));
                    if (meData.email) {
                        localStorage.setItem('verificationEmail', meData.email);
                    }
                    if (meData.is_email_verified === false && meData.role !== 'admin') {
                        navigate('/verify-otp', { state: { email: meData.email } });
                    }
                } catch (error) {
                    console.error("Auth check failed", error);
                    // Only logout on 401 Unauthorized
                    if (error.response?.status === 401) {
                        logout();
                    }
                }
            }
            setLoading(false);
        };
        checkAuth();
    }, [token]);

    const login = async (email, password) => {
        try {
            const res = await api.post('auth/login/', { username: email, password });
            const {
                token,
                role: userRole,
                user_id,
                email: userEmail,
                is_email_verified,
                profile_completed,
                provider_onboarding_required
            } = res.data;

            localStorage.setItem('token', token);
            // localStorage.setItem('refresh_token', refresh); // Not using JWT anymore
            localStorage.setItem('userRole', userRole);
            localStorage.setItem('userId', user_id);
            localStorage.setItem('verificationEmail', userEmail);

            setToken(token);
            setRole(userRole);
            setUser({
                id: user_id,
                role: userRole,
                email: userEmail,
                is_email_verified: Boolean(is_email_verified),
            });

            if (!is_email_verified && userRole !== 'admin') {
                navigate('/verify-otp', { state: { email: userEmail } });
                return res.data;
            }

            if (userRole === 'provider' && provider_onboarding_required) {
                navigate('/provider-onboarding');
            } else if (!profile_completed) {
                navigate('/dashboard/settings?onboarding=1');
            } else if (userRole === 'admin') {
                navigate('/dashboard/admin');
            } else if (userRole === 'provider') {
                navigate('/dashboard/provider');
            } else {
                navigate('/dashboard');
            }

            return res.data;
        } catch (error) {
            console.error("Login failed", error);
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userId');
        localStorage.removeItem('verificationEmail');
        setToken(null);
        setRole(null);
        setUser(null);
        navigate('/login');
    };

    const value = {
        user,
        token,
        role,
        loading,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
