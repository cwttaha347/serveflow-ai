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
                    // Start basic validity check (optional: verify with backend)
                    // For now, we assume token presence is enough to try loading user
                    // In a real app, you'd hit a /me endpoint

                    // setUser({ role }); // simplified
                } catch (error) {
                    console.error("Auth check failed", error);
                    logout();
                }
            }
            setLoading(false);
        };
        checkAuth();
    }, [token]);

    const login = async (email, password) => {
        try {
            const res = await api.post('auth/login/', { username: email, password });
            const { token, role: userRole, user_id } = res.data;

            localStorage.setItem('token', token);
            // localStorage.setItem('refresh_token', refresh); // Not using JWT anymore
            localStorage.setItem('userRole', userRole);
            localStorage.setItem('userId', user_id);

            setToken(token);
            setRole(userRole);

            // Redirect based on role
            if (userRole === 'admin') navigate('/dashboard/admin');
            else if (userRole === 'provider') navigate('/dashboard/provider');
            else navigate('/dashboard');

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
