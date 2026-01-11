import { useState, useEffect } from 'react';
import api from '../api';
import { Star, ThumbsUp, MessageCircle } from 'lucide-react';

const Reviews = () => {
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReviews = async () => {
            try {
                const response = await api.get('reviews/');
                setReviews(response.data);
            } catch (error) {
                console.error('Error fetching reviews:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchReviews();
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Reviews</h1>
            </div>

            {loading ? (
                <div className="text-center py-12">Loading reviews...</div>
            ) : reviews.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <p className="text-slate-500">No reviews yet.</p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {reviews.map((review) => (
                        <div key={review.id} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    {[...Array(5)].map((_, i) => (
                                        <Star
                                            key={i}
                                            className={`w-5 h-5 ${i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`}
                                        />
                                    ))}
                                    <span className="font-bold ml-2">{review.rating}.0</span>
                                </div>
                                <span className="text-sm text-slate-500">{new Date(review.created_at).toLocaleDateString()}</span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 mb-4">
                                "{review.comment}"
                            </p>
                            <div className="flex justify-between text-sm text-slate-500 border-t pt-4">
                                <span>Job #{review.job}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Reviews;
