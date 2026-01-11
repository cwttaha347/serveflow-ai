import { useState, useEffect } from 'react';
import api from '../api';
import { User, MapPin, Briefcase, Clock, Save, Loader2, Mail, Phone, Upload } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const ProviderProfile = () => {
    // Separate state for different models to reliably update them
    const [userData, setUserData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone: ''
    });
    const [profileData, setProfileData] = useState({
        bio: '',
        address: ''
    });
    const [providerData, setProviderData] = useState({
        availability_status: 'available',
        hourly_rate: ''
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { success, error: showError } = useToast();

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const [userRes, providerRes] = await Promise.all([
                api.get('users/me/'),
                api.get('providers/me/')
            ]);

            // User Data
            setUserData({
                first_name: userRes.data.first_name || '',
                last_name: userRes.data.last_name || '',
                email: userRes.data.email || '',
                phone: userRes.data.phone || ''
            });

            // Profile Data (Nested in User)
            setProfileData({
                bio: userRes.data.profile?.bio || '',
                address: userRes.data.profile?.address || ''
            });

            // Provider Data
            setProviderData({
                availability_status: providerRes.data.availability_status || 'available',
                hourly_rate: providerRes.data.hourly_rate || '' // Ensure this matches API field name exactly, sometimes endpoint might return 'cost' etc. Assuming 'hourly_rate' based on previous context but Model says 'base_price' or similar? Let's check model...
                // Model Provider has: rating, completed_jobs, total_earnings, availability_status. 
                // Model Category has base_price. 
                // Wait, Provider model does NOT have hourly_rate! 
                // Let's check models.py again. 
                // Provider model only has: user, verified, rating, completed_jobs, categories, total_earnings, availability_status.
                // It does NOT have hourly rate. 
            });
            // Re-evaluating Provider Rate: Rate is usually per Job or per Category. 
            // If the user wants to set a "Default Hourly Rate", it might need to be added to Provider model or it's just 'total_earnings' which is wrong. 
            // Let's check if the user request implied specific rate management. "profile updating with informations".
            // If the model lacks it, I can add it or just omit it. 
            // Let's add it to the Provider model to be safe as it's a common feature? 
            // Or maybe it's in Category? 
            // Provider -> Categories (M2M).
            // Let's sticking to `availability_status` for Provider. And User/Profile info. 
            // I'll leave out 'Hourly Rate' from Provider update if it's not in the model, to avoid 500 erors. 
            // Or I can add it to the bio for now or suggest adding it to the model. 
            // Let's check models.py content again to be 100% sure. 

        } catch (error) {
            console.error('Error fetching profile:', error);
            showError('Failed to load profile data');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await Promise.all([
                api.patch('users/me/', userData),
                api.patch('profiles/me/', profileData),
                api.patch('providers/me/', {
                    availability_status: providerData.availability_status
                    // Removed hourly_rate as it is likely not in model
                })
            ]);
            success('Profile updated successfully');
        } catch (error) {
            console.error('Error updating profile:', error);
            showError('Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Provider Profile</h1>
                <p className="text-slate-500 dark:text-slate-400">Manage your personal and professional details</p>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
                {loading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-8">

                        {/* Personal Information */}
                        <section className="space-y-4">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 border-b pb-2 dark:border-slate-700">Personal Information</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">First Name</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                        <input
                                            type="text"
                                            value={userData.first_name}
                                            onChange={(e) => setUserData({ ...userData, first_name: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Last Name</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                        <input
                                            type="text"
                                            value={userData.last_name}
                                            onChange={(e) => setUserData({ ...userData, last_name: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                        <input
                                            type="email"
                                            value={userData.email}
                                            onChange={(e) => setUserData({ ...userData, email: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Phone Number</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                        <input
                                            type="tel"
                                            value={userData.phone}
                                            onChange={(e) => setUserData({ ...userData, phone: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Professional Details */}
                        <section className="space-y-4">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 border-b pb-2 dark:border-slate-700">Service Details</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="col-span-full">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Professional Bio</label>
                                    <div className="relative">
                                        <Briefcase className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                                        <textarea
                                            value={profileData.bio}
                                            onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                                            rows={4}
                                            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Describe your skills and experience..."
                                        />
                                    </div>
                                </div>
                                <div className="col-span-full">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Base Location / Service Area</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                        <input
                                            type="text"
                                            value={profileData.address}
                                            onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g. New York, NY"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Availability Status</label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                        <select
                                            value={providerData.availability_status}
                                            onChange={(e) => setProviderData({ ...providerData, availability_status: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="available">Available for New Jobs</option>
                                            <option value="busy">Busy / On Job</option>
                                            <option value="offline">Offline / Unavailable</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <div className="flex justify-end pt-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 text-base font-semibold shadow-lg hover:shadow-xl"
                            >
                                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                                Save Profile Changes
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ProviderProfile;
