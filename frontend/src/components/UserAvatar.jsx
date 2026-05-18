import { resolvePhotoUrl } from '../utils/mediaUrl';

export { resolvePhotoUrl };

const UserAvatar = ({ photo, name, username, className = 'w-9 h-9 lg:w-11 lg:h-11' }) => {
    const label = (name || username || '?').trim();
    const initial = label.charAt(0).toUpperCase();
    const src = resolvePhotoUrl(photo);

    if (src) {
        return (
            <img
                src={src}
                alt={label}
                className={`${className} rounded-[1rem] object-cover shadow-lg shadow-blue-500/20 border-2 border-white/20`}
            />
        );
    }

    return (
        <div
            className={`${className} bg-gradient-to-br from-blue-600 to-purple-600 rounded-[1rem] flex items-center justify-center text-white font-black shadow-lg shadow-blue-500/20 text-sm`}
        >
            {initial}
        </div>
    );
};

export default UserAvatar;
