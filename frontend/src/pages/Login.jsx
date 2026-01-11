import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Mail, Lock, Loader2, ArrowRight, User, Phone, UserCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api';
import { useSettings } from '../context/SettingsContext';

const Login = () => {
    const { settings } = useSettings();
    // Mode toggle: 'login' or 'register'
    const [mode, setMode] = useState('login');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Login State
    const [loginData, setLoginData] = useState({ username: '', password: '' });

    // Register State
    const [registerData, setRegisterData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        first_name: '',
        last_name: '',
        phone: '',
        role: 'user'
    });

    const { login } = useAuth();
    const { success, error: toastError } = useToast();
    const navigate = useNavigate();

    const handleLoginChange = (e) => {
        setLoginData({ ...loginData, [e.target.name]: e.target.value });
        setError('');
    };

    const handleRegisterChange = (e) => {
        setRegisterData({ ...registerData, [e.target.name]: e.target.value });
        setError('');
    };

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await login(loginData.username, loginData.password);
        } catch (err) {
            setError(err.response?.data?.error || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    const handleRegisterSubmit = async (e) => {
        e.preventDefault();

        // Basic Validation
        if (registerData.username.length < 3) return setError('Username too short');
        if (registerData.password.length < 8) return setError('Password too short (8+ chars)');
        if (registerData.password !== registerData.confirmPassword) return setError('Passwords do not match');

        setLoading(true);
        setError('');

        try {
            await api.post('users/', {
                username: registerData.username,
                email: registerData.email,
                password: registerData.password,
                first_name: registerData.first_name,
                last_name: registerData.last_name,
                phone: registerData.phone,
                role: registerData.role
            });
            success('Account created! Logging you in...');

            // Auto login after register
            await login(registerData.username, registerData.password);
        } catch (err) {
            console.error(err);
            const msg = err.response?.data ? JSON.stringify(err.response.data) : 'Registration failed';
            setError(msg.replace(/[{"}]/g, '').replace(/,/g, ', '));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-slate-50 dark:bg-slate-900">
            {/* Left Side - Form */}
            <div className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24 w-full lg:w-[45%] bg-white dark:bg-slate-900 z-10 relative overflow-hidden">
                <div className="mx-auto w-full max-w-sm lg:w-[28rem]"> {/* Increased width for reg form */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                                <span className="text-white text-xl font-bold">S</span>
                            </div>
                            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                                {settings.platform_name}
                            </span>
                        </div>
                        <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                            {mode === 'login' ? 'Welcome back' : 'Create an account'}
                        </h2>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            {mode === 'login' ? 'Please enter your details to sign in' : 'Join our professional network today'}
                        </p>
                    </motion.div>

                    <AnimatePresence mode="wait">
                        {mode === 'login' ? (
                            <motion.form
                                key="login"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="space-y-6"
                                onSubmit={handleLoginSubmit}
                            >
                                {error && (
                                    <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">
                                        {error}
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                                        Email address or Username
                                    </label>
                                    <div className="mt-2 relative">
                                        <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                                        <input
                                            name="username"
                                            type="text"
                                            required
                                            value={loginData.username}
                                            onChange={handleLoginChange}
                                            className="block w-full pl-10 pr-3 py-3 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                                            placeholder="Enter email or username"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
                                        <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-500">Forgot password?</Link>
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                                        <input
                                            name="password"
                                            type="password"
                                            required
                                            value={loginData.password}
                                            onChange={handleLoginChange}
                                            className="block w-full pl-10 pr-3 py-3 border border-slate-300 dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                                            placeholder="•••••••"
                                        />
                                    </div>
                                </div>
                                <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex justify-center items-center">
                                    {loading ? <Loader2 className="animate-spin" /> : 'Sign in'}
                                </button>
                            </motion.form>
                        ) : (
                            <motion.form
                                key="register"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-4"
                                onSubmit={handleRegisterSubmit}
                            >
                                {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

                                {/* Role Toggle */}
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <button type="button" onClick={() => setRegisterData({ ...registerData, role: 'user' })}
                                        className={`p-3 rounded-lg border-2 flex flex-col items-center ${registerData.role === 'user' ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                                        <UserCircle className={registerData.role === 'user' ? 'text-blue-500' : 'text-slate-400'} />
                                        <span className="text-sm font-bold mt-1">Customer</span>
                                    </button>
                                    <button type="button" onClick={() => setRegisterData({ ...registerData, role: 'provider' })}
                                        className={`p-3 rounded-lg border-2 flex flex-col items-center ${registerData.role === 'provider' ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}>
                                        <User className={registerData.role === 'provider' ? 'text-blue-500' : 'text-slate-400'} />
                                        <span className="text-sm font-bold mt-1">Provider</span>
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <input name="first_name" placeholder="First Name" required value={registerData.first_name} onChange={handleRegisterChange} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-800 dark:text-white" />
                                    <input name="last_name" placeholder="Last Name" required value={registerData.last_name} onChange={handleRegisterChange} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-800 dark:text-white" />
                                </div>
                                <input name="username" placeholder="Username (required)" required value={registerData.username} onChange={handleRegisterChange} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-800 dark:text-white" />
                                <input name="email" type="email" placeholder="Email Address" required value={registerData.email} onChange={handleRegisterChange} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-800 dark:text-white" />
                                <input name="password" type="password" placeholder="Password (8+ chars)" required value={registerData.password} onChange={handleRegisterChange} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-800 dark:text-white" />
                                <input name="confirmPassword" type="password" placeholder="Confirm Password" required value={registerData.confirmPassword} onChange={handleRegisterChange} className="w-full px-4 py-2 border rounded-lg dark:bg-slate-800 dark:text-white" />

                                <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg flex justify-center items-center">
                                    {loading ? <Loader2 className="animate-spin" /> : 'Create Account'}
                                </button>
                            </motion.form>
                        )}
                    </AnimatePresence>

                    <div className="mt-8 text-center text-sm">
                        <span className="text-slate-600 dark:text-slate-400">
                            {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
                        </span>
                        <button
                            onClick={() => {
                                setMode(mode === 'login' ? 'register' : 'login');
                                setError('');
                            }}
                            className="ml-2 font-medium text-blue-600 hover:text-blue-500 hover:underline"
                        >
                            {mode === 'login' ? 'Sign up for free' : 'Sign in'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Side - Image/Design - Kept Static */}
            <div className="hidden lg:block relative flex-1">
                <div className="absolute inset-0 bg-blue-600">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-900 opacity-90" />
                    <img
                        className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-30"
                        src="https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&auto=format&fit=crop&w=1574&q=80"
                        alt="Background"
                    />
                </div>

                <div className="relative h-full flex items-center justify-center p-12 text-white">
                    <div className="max-w-xl text-center">
                        <motion.h2
                            key={mode}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="text-4xl font-bold mb-6"
                        >
                            {mode === 'login'
                                ? `The AI-Powered Marketplace for Professional Services`
                                : `Join the Future of Service Connection on ${settings.platform_name}`}
                        </motion.h2>
                        <p className="text-lg text-blue-100">
                            Experience the future of service connection. Intelligent matching, seamless bidding, and secure completions.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;

