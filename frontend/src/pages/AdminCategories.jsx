import { useState, useEffect } from 'react';
import api from '../api';
import { Plus, Edit2, Trash2, Search, Loader2, Image as ImageIcon } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const AdminCategories = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const { success, error: showError } = useToast();

    // Form state
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        base_price: '',
        pricing_model: 'fixed',
        is_active: true,
        image: null
    });
    const [imagePreview, setImagePreview] = useState(null);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const response = await api.get('categories/');
            setCategories(response.data);
        } catch (error) {
            console.error('Error fetching categories:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (category = null) => {
        if (category) {
            setEditingCategory(category);
            setFormData({
                name: category.name,
                description: category.description,
                base_price: category.base_price,
                pricing_model: category.pricing_model,
                is_active: category.is_active,
                image: null  // Reset image to null for editing
            });
            // Set image preview to existing image if available
            setImagePreview(category.image ? (category.image.startsWith('http') ? category.image : `http://127.0.0.1:8000${category.image}`) : null);
        } else {
            setEditingCategory(null);
            setFormData({
                name: '',
                description: '',
                base_price: '',
                pricing_model: 'fixed',
                is_active: true,
                image: null
            });
            setImagePreview(null);
        }
        setModalOpen(true);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData({ ...formData, image: file });
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const data = new FormData();
        data.append('name', formData.name);
        data.append('description', formData.description);
        data.append('base_price', formData.base_price);
        data.append('pricing_model', formData.pricing_model);
        data.append('is_active', formData.is_active);
        if (formData.image instanceof File) {
            data.append('image', formData.image);
        }

        try {
            if (editingCategory) {
                await api.patch(`categories/${editingCategory.id}/`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                success('Category updated successfully');
            } else {
                await api.post('categories/', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                success('Category created successfully');
            }
            setModalOpen(false);
            fetchCategories();
        } catch (error) {
            console.error('Error saving category:', error);
            console.error('Error response:', error.response);
            console.error('Error response data:', error.response?.data);
            console.error('Error response status:', error.response?.status);

            // Display specific error message if available
            let errorMessage = 'Failed to save category';
            if (error.response?.data) {
                const errorData = error.response.data;
                if (typeof errorData === 'object') {
                    // Get the first error message from the response
                    const firstKey = Object.keys(errorData)[0];
                    if (firstKey && errorData[firstKey]) {
                        const firstError = Array.isArray(errorData[firstKey])
                            ? errorData[firstKey][0]
                            : errorData[firstKey];
                        errorMessage = `${firstKey}: ${firstError}`;
                    }
                } else if (typeof errorData === 'string') {
                    errorMessage = errorData;
                }
            }
            showError(errorMessage);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this category?')) return;
        try {
            await api.delete(`categories/${id}/`);
            success('Category deleted');
            fetchCategories();
        } catch (error) {
            showError('Failed to delete category');
        }
    };

    const filteredCategories = categories.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Service Categories</h1>
                    <p className="text-slate-500 dark:text-slate-400">Manage available services and pricing</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-lg hover:shadow-blue-500/20 font-bold"
                >
                    <Plus className="w-5 h-5" /> Create New Category
                </button>
            </div>

            {/* Search */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input
                        type="text"
                        placeholder="Search categories..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="text-primary hover:text-blue-700 font-medium flex items-center gap-1 sm:hidden"
                >
                    <Plus className="w-4 h-4" /> New Category
                </button>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                    <thead className="bg-slate-50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300">
                        <tr>
                            <th className="px-6 py-4 font-semibold">Name</th>
                            <th className="px-6 py-4 font-semibold">Pricing Model</th>
                            <th className="px-6 py-4 font-semibold">Base Price</th>
                            <th className="px-6 py-4 font-semibold">Status</th>
                            <th className="px-6 py-4 font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {loading ? (
                            <tr><td colSpan="5" className="p-8 text-center">Loading...</td></tr>
                        ) : filteredCategories.length === 0 ? (
                            <tr><td colSpan="5" className="p-8 text-center">No categories found.</td></tr>
                        ) : (
                            filteredCategories.map((cat) => (
                                <tr key={cat.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100 flex items-center gap-3">
                                        {cat.image ? (
                                            <img
                                                src={cat.image.startsWith('http') ? cat.image : `http://127.0.0.1:8000${cat.image}`}
                                                alt={cat.name}
                                                className="w-10 h-10 rounded-lg object-cover"
                                            />
                                        ) : (
                                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                                                <ImageIcon className="w-5 h-5 text-slate-400" />
                                            </div>
                                        )}
                                        {cat.name}
                                    </td>
                                    <td className="px-6 py-4 capitalize">{cat.pricing_model}</td>
                                    <td className="px-6 py-4">${cat.base_price}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${cat.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'}`}>
                                            {cat.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button
                                            onClick={() => handleOpenModal(cat)}
                                            className="p-1 text-slate-400 hover:text-blue-500"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(cat.id)}
                                            className="p-1 text-slate-400 hover:text-red-500"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
                    <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                            {editingCategory ? 'Edit Service' : 'Add New Service'}
                        </h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Service Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600"
                                    rows={3}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Base Price ($)</label>
                                    <input
                                        type="number"
                                        value={formData.base_price}
                                        onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Pricing Model</label>
                                    <select
                                        value={formData.pricing_model}
                                        onChange={(e) => setFormData({ ...formData, pricing_model: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600"
                                    >
                                        <option value="fixed">Fixed Price</option>
                                        <option value="hourly">Hourly Rate</option>
                                        <option value="quote">Quote Based</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        id="is_active"
                                    />
                                    <label htmlFor="is_active" className="text-sm font-medium">Active Service</label>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">Service Image</label>
                                <div className="flex items-center gap-4">
                                    {(imagePreview || (editingCategory && editingCategory.image)) && (
                                        <img
                                            src={imagePreview || editingCategory.image}
                                            alt="Preview"
                                            className="w-16 h-16 rounded-lg object-cover"
                                        />
                                    )}
                                    <input
                                        type="file"
                                        onChange={handleImageChange}
                                        accept="image/*"
                                        className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                onClick={() => setModalOpen(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-slate-800 transition-colors"
                            >
                                Save Service
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminCategories;
