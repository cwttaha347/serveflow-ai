import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, ArrowLeft, Loader2 } from 'lucide-react';
import api from '../api';
import { useToast } from '../context/ToastContext';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const email = searchParams.get('email');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { success, error: showError } = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            showError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            await api.post('users/reset_password/', { email, password });
            success('Password reset successfully! Please login with your new password.');
            navigate('/login');
        } catch (err) {
            console.error('Error resetting password:', err);
            showError('Failed to reset password. Please try again or request a new link.');
        } finally {
            setLoading(false);
        }
    };

    if (!email) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 text-center">
                    <h1 className="text-2xl font-bold text-red-500 mb-4">Invalid Reset Link</h1>
                    <p className="text-slate-500 mb-6">This link is invalid or expired. Please request a new one.</p>
                    <button onClick={() => navigate('/forgot-password')} className="text-primary font-semibold hover:underline">
                        Request Reset Link
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
                <button
                    onClick={() => navigate('/login')}
                    className="flex items-center text-slate-500 hover:text-primary mb-6 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back to Login
                </button>

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">New Password</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Resetting password for <span className="font-semibold">{email}</span></p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">New Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                placeholder="••••••••"
                                required
                                minLength={6}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Confirm Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary text-white py-2 rounded-lg font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                    >
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Reset Password
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;
