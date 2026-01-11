import { useState, useEffect } from 'react';
import api from '../api';
import { Upload, FileText, Download, Trash2 } from 'lucide-react';

const DocumentList = () => {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            const response = await api.get('documents/');
            setDocuments(response.data);
        } catch (error) {
            console.error('Error fetching documents:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', file.name);
        formData.append('category', 'General'); // Default category
        // formData.append('owner', 1); // TODO: Get current user ID

        setUploading(true);
        try {
            await api.post('documents/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            fetchDocuments();
        } catch (error) {
            console.error('Error uploading document:', error);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-800">Documents</h1>
                <label className="bg-primary text-white px-4 py-2 rounded-lg flex items-center hover:bg-slate-800 transition-colors cursor-pointer">
                    <Upload className="w-5 h-5 mr-2" />
                    {uploading ? 'Uploading...' : 'Upload Document'}
                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {loading ? (
                    <p className="text-slate-500 col-span-3 text-center py-8">Loading documents...</p>
                ) : documents.length === 0 ? (
                    <p className="text-slate-500 col-span-3 text-center py-8">No documents found.</p>
                ) : (
                    documents.map((doc) => (
                        <div key={doc.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-blue-50 rounded-lg">
                                    <FileText className="w-6 h-6 text-blue-500" />
                                </div>
                                <div className="flex space-x-2">
                                    <button className="text-slate-400 hover:text-blue-500">
                                        <Download className="w-4 h-4" />
                                    </button>
                                    <button className="text-slate-400 hover:text-red-500">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <h3 className="font-semibold text-slate-900 truncate" title={doc.title}>{doc.title}</h3>
                            <p className="text-sm text-slate-500 mt-1">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
                            <div className="mt-4 flex items-center justify-between text-xs">
                                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded">{doc.category}</span>
                                <span className="text-slate-400">{(doc.file_size / 1024).toFixed(1)} KB</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default DocumentList;
