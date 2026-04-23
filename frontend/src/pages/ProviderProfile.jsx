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
        bio: '',
        experience_years: 0,
        skills: [],
        categories: []
    });
    const [allCategories, setAllCategories] = useState([]);
    const [skillInput, setSkillInput] = useState('');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { success, error: showError } = useToast();

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const [userRes, providerRes, catRes] = await Promise.all([
                api.get('users/me/'),
                api.get('providers/me/'),
                api.get('categories/')
            ]);
            setAllCategories(catRes.data);

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
                bio: providerRes.data.bio || '',
                experience_years: providerRes.data.experience_years || 0,
                skills: providerRes.data.skills || [],
                categories: providerRes.data.categories?.map(c => c.id) || []
            });
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
                    availability_status: providerData.availability_status,
                    bio: providerData.bio,
                    experience_years: providerData.experience_years,
                    skills: providerData.skills,
                    categories: providerData.categories
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
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 border-b pb-2 dark:border-slate-700">Work Portfolio</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="col-span-full">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Professional Bio</label>
                                    <div className="relative">
                                        <Briefcase className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
                                        <textarea
                                            value={providerData.bio}
                                            onChange={(e) => setProviderData({ ...providerData, bio: e.target.value })}
                                            rows={4}
                                            className="w-full pl-10 pr-4 py-3 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                            placeholder="Tell customers about your expertise, experience, and why they should hire you..."
                                        />
                                    </div>
                                </div>
                                
                                <div className="col-span-full">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Service Categories</label>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {allCategories.map(cat => (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => {
                                                    const current = providerData.categories;
                                                    if (current.includes(cat.id)) {
                                                        setProviderData({ ...providerData, categories: current.filter(id => id !== cat.id) });
                                                    } else {
                                                        setProviderData({ ...providerData, categories: [...current, cat.id] });
                                                    }
                                                }}
                                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                                                    providerData.categories.includes(cat.id)
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/20'
                                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-500'
                                                }`}
                                            >
                                                {cat.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Years of Experience</label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                        <input
                                            type="number"
                                            value={providerData.experience_years}
                                            onChange={(e) => setProviderData({ ...providerData, experience_years: parseInt(e.target.value) || 0 })}
                                            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            min="0"
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
                                            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="available">Available for New Jobs</option>
                                            <option value="busy">Busy / On Job</option>
                                            <option value="offline">Offline / Unavailable</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="col-span-full">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Skills & Specializations</label>
                                    <div className="flex flex-wrap gap-2 mb-3">
                                        {providerData.skills.map((skill, i) => (
                                            <span key={i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700">
                                                {skill}
                                                <button 
                                                    type="button" 
                                                    onClick={() => setProviderData({ ...providerData, skills: providerData.skills.filter((_, idx) => idx !== i) })}
                                                    className="hover:text-red-500 transition-colors"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={skillInput}
                                            onChange={(e) => setSkillInput(e.target.value)}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    if (skillInput.trim()) {
                                                        setProviderData({ ...providerData, skills: [...providerData.skills, skillInput.trim()] });
                                                        setSkillInput('');
                                                    }
                                                }
                                            }}
                                            placeholder="Add a skill (e.g. Italian Plumbing, Emergency Wiring) and press Enter"
                                            className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (skillInput.trim()) {
                                                    setProviderData({ ...providerData, skills: [...providerData.skills, skillInput.trim()] });
                                                    setSkillInput('');
                                                }
                                            }}
                                            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 border-b pb-2 dark:border-slate-700">Contact Details</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="col-span-full">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Base Location / Service Area</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                        <input
                                            type="text"
                                            value={profileData.address}
                                            onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                                            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="e.g. New York, NY"
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        <div className="flex justify-end pt-8">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center gap-3 px-10 py-5 bg-blue-600 text-white rounded-[1.5rem] font-black hover:bg-blue-500 shadow-xl shadow-blue-600/30 transition-all active:scale-[0.98] disabled:opacity-50"
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
