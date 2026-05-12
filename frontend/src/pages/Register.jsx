import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { User, Mail, Lock, Phone, UserCircle } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const Register = () => {
    const { success, error: showError } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        first_name: '',
        last_name: '',
        phone: '',
        role: 'user',
        category_ids: []
    });
    const [errors, setErrors] = useState({});
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        api.get('categories/')
            .then((res) => setCategories(res.data.filter((c) => c.is_active)))
            .catch(() => setCategories([]));
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setErrors({ ...errors, [e.target.name]: '' });
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.username || formData.username.length < 3) {
            newErrors.username = 'Username must be at least 3 characters';
        }

        if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Valid email is required';
        }

        if (!formData.password || formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        }

        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }
        if (formData.role === 'provider' && formData.category_ids.length === 0) {
            newErrors.category_ids = 'Select at least one category';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setLoading(true);
        try {
            const reg = await api.post('users/', {
                username: formData.username,
                email: formData.email,
                password: formData.password,
                first_name: formData.first_name,
                last_name: formData.last_name,
                phone: formData.phone,
                role: formData.role,
                category_ids: formData.role === 'provider' ? formData.category_ids : []
            });

            if (reg.data?.token) {
                localStorage.setItem('token', reg.data.token);
                localStorage.setItem('userRole', reg.data.role || '');
                localStorage.setItem('userId', String(reg.data.id || ''));
            }

            // OTP email is sent once from the server on user creation (do not call request-otp here — it would send a second code).
            localStorage.setItem('verificationEmail', formData.email);
            success('Registration successful. Verify your email to continue.');
            window.location.assign('/verify-otp');
        } catch (error) {
            console.error('Registration error:', error);
            if (error.response?.data) {
                const serverErrors = error.response.data;
                setErrors(serverErrors);
                showError('Registration failed. Please check the form.');
            } else {
                showError('Registration failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-primary dark:text-blue-400">Create Account</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">Join our AI-powered service platform</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                    {/* Role Selection */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            I want to register as:
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, role: 'user' })}
                                className={`p-4 border-2 rounded-lg transition-all ${formData.role === 'user'
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-slate-200 dark:border-slate-700'
                                    }`}
                            >
                                <UserCircle className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                                <p className="font-semibold text-slate-900 dark:text-slate-100">Customer</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Request services</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, role: 'provider' })}
                                className={`p-4 border-2 rounded-lg transition-all ${formData.role === 'provider'
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-slate-200 dark:border-slate-700'
                                    }`}
                            >
                                <User className="w-8 h-8 mx-auto mb-2 text-green-500" />
                                <p className="font-semibold text-slate-900 dark:text-slate-100">Provider</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Offer services</p>
                            </button>
                        </div>
                    </div>

                    {/* Personal Info */}
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                First Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="first_name"
                                value={formData.first_name}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Last Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="last_name"
                                value={formData.last_name}
                                onChange={handleChange}
                                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                                required
                            />
                        </div>
                    </div>

                    {/* Account Info */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Username <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                className={`w-full pl-10 pr-4 py-2 border dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 ${errors.username ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'
                                    }`}
                                required
                            />
                        </div>
                        {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Email <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className={`w-full pl-10 pr-4 py-2 border dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 ${errors.email ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'
                                    }`}
                                required
                            />
                        </div>
                        {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Phone (Optional)
                        </label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {formData.role === 'provider' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                Service Categories <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {categories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => {
                                            const exists = formData.category_ids.includes(cat.id);
                                            setFormData({
                                                ...formData,
                                                category_ids: exists
                                                    ? formData.category_ids.filter((id) => id !== cat.id)
                                                    : [...formData.category_ids, cat.id],
                                            });
                                        }}
                                        className={`px-3 py-2 rounded-lg border text-xs font-semibold ${
                                            formData.category_ids.includes(cat.id)
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                                : 'border-slate-200 dark:border-slate-700'
                                        }`}
                                    >
                                        {cat.name}
                                    </button>
                                ))}
                            </div>
                            {errors.category_ids && <p className="text-red-500 text-xs mt-1">{errors.category_ids}</p>}
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Password <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                className={`w-full pl-10 pr-4 py-2 border dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 ${errors.password ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'
                                    }`}
                                required
                            />
                        </div>
                        {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Confirm Password <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="password"
                                name="confirmPassword"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                className={`w-full pl-10 pr-4 py-2 border dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 ${errors.confirmPassword ? 'border-red-500' : 'border-slate-200 dark:border-slate-600'
                                    }`}
                                required
                            />
                        </div>
                        {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>

                    <p className="text-center text-slate-600 dark:text-slate-400">
                        Already have an account?{' '}
                        <Link to="/login" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
                            Login here
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
};

export default Register;
