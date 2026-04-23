import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useToast } from '../context/ToastContext';

const ProviderOnboarding = () => {
    const navigate = useNavigate();
    const { success, error: showError } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [categories, setCategories] = useState([]);
    const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
    const [skills, setSkills] = useState([]);
    const [customSkill, setCustomSkill] = useState('');
    const [bio, setBio] = useState('');
    const [experienceYears, setExperienceYears] = useState(1);

    useEffect(() => {
        const load = async () => {
            try {
                const [catRes, providerRes] = await Promise.all([
                    api.get('categories/'),
                    api.get('providers/me/'),
                ]);
                const activeCategories = catRes.data.filter((c) => c.is_active);
                setCategories(activeCategories);
                
                // Redirect if already completed
                if (providerRes.data.onboarding_completed) {
                    navigate('/dashboard/provider');
                    return;
                }

                setSelectedCategoryIds((providerRes.data.categories || []).map((c) => c.id));
                setSkills(providerRes.data.skills || []);
                setBio(providerRes.data.bio || '');
                setExperienceYears(providerRes.data.experience_years || 1);
            } catch (err) {
                showError('Failed to initialize provider onboarding.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const toggleCategory = (categoryId) => {
        setSelectedCategoryIds((prev) =>
            prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
        );
    };

    const generateSkills = async () => {
        if (!selectedCategoryIds.length) {
            showError('Please select at least one category.');
            return;
        }
        try {
            setGenerating(true);
            const res = await api.post('providers/skill_suggestions/', { category_ids: selectedCategoryIds });
            const generated = res.data.skills || [];
            setSkills(Array.from(new Set([...skills, ...generated])));
            success('AI generated skill suggestions based on your categories.');
        } catch (err) {
            showError(err.response?.data?.error || 'Failed to generate skills.');
        } finally {
            setGenerating(false);
        }
    };

    const addCustomSkill = () => {
        const trimmed = customSkill.trim();
        if (!trimmed) return;
        if (!skills.includes(trimmed)) {
            setSkills([...skills, trimmed]);
        }
        setCustomSkill('');
    };

    const removeSkill = (skill) => {
        setSkills(skills.filter((s) => s !== skill));
    };

    const completeOnboarding = async () => {
        if (selectedCategoryIds.length === 0) {
            showError('Select at least one category.');
            return;
        }
        if (skills.length < 2) {
            showError('Add at least two skills.');
            return;
        }
        try {
            setSaving(true);
            await api.post('providers/complete_onboarding/', {
                category_ids: selectedCategoryIds,
                skills,
                bio,
                experience_years: Number(experienceYears || 0),
            });
            success('Provider setup complete. Welcome to your dashboard.');
            navigate('/dashboard/provider');
        } catch (err) {
            showError(err.response?.data?.error || 'Failed to complete onboarding.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white p-6">
            <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8">
                <h1 className="text-3xl font-black mb-2">Complete Your Provider Setup</h1>
                <p className="text-slate-400 mb-8">Select categories and let AI generate skill tags for your profile.</p>

                <div className="mb-8">
                    <h2 className="text-lg font-bold mb-3">Service Categories</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => toggleCategory(cat.id)}
                                className={`px-4 py-3 rounded-xl border text-left ${
                                    selectedCategoryIds.includes(cat.id)
                                        ? 'bg-blue-600/20 border-blue-500 text-blue-200'
                                        : 'bg-slate-800 border-slate-700'
                                }`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-lg font-bold">Skills</h2>
                        <button
                            type="button"
                            onClick={generateSkills}
                            disabled={generating}
                            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
                        >
                            {generating ? 'Generating...' : 'Generate AI Skills'}
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-3">
                        {skills.map((skill) => (
                            <button
                                key={skill}
                                type="button"
                                onClick={() => removeSkill(skill)}
                                className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-sm hover:border-red-500"
                                title="Remove"
                            >
                                {skill} x
                            </button>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <input
                            value={customSkill}
                            onChange={(e) => setCustomSkill(e.target.value)}
                            className="flex-1 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700"
                            placeholder="Add custom skill"
                        />
                        <button type="button" onClick={addCustomSkill} className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600">
                            Add
                        </button>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4 mb-8">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Experience (years)</label>
                        <input
                            type="number"
                            min="0"
                            value={experienceYears}
                            onChange={(e) => setExperienceYears(e.target.value)}
                            className="w-full px-4 py-2 rounded-xl bg-slate-800 border border-slate-700"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">About You (optional)</label>
                        <input
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            className="w-full px-4 py-2 rounded-xl bg-slate-800 border border-slate-700"
                            placeholder="Short provider bio"
                        />
                    </div>
                </div>

                <button
                    type="button"
                    onClick={completeOnboarding}
                    disabled={saving}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 font-bold"
                >
                    {saving ? 'Saving...' : 'Complete Provider Setup'}
                </button>
            </div>
        </div>
    );
};

export default ProviderOnboarding;
