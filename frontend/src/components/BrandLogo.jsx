import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

export const LOGO_SRC = `${import.meta.env.BASE_URL}serveflow-logo.png`;

const SIZE_CLASS = {
    nav: 'h-8 sm:h-10 w-auto max-w-[140px] sm:max-w-[180px]',
    auth: 'h-12 sm:h-14 w-auto max-w-[220px]',
    hero: 'h-14 sm:h-16 lg:h-20 w-auto max-w-[260px] lg:max-w-[320px]',
    sidebar: 'h-9 w-9 sm:h-10 sm:w-10',
    invoice: 'h-10 sm:h-12 w-auto max-w-[200px]',
    footer: 'h-8 w-auto max-w-[160px]',
};

/**
 * ServeFlow brand mark — use public asset for Vite/Docker static serving.
 */
const BrandLogo = ({
    size = 'nav',
    showName = false,
    linkTo = '/',
    className = '',
    nameClassName = '',
    unlinked = false,
}) => {
    const { settings } = useSettings();
    const platformName = settings?.platform_name || 'ServeFlow AI';

    const image = (
        <span className={`inline-flex shrink-0 items-center ${unlinked && showName ? 'gap-2' : ''}`}>
            <img
                src={LOGO_SRC}
                alt={platformName}
                className={`object-contain select-none dark:brightness-110 dark:contrast-105 ${SIZE_CLASS[size] || SIZE_CLASS.nav} ${className}`}
                decoding="async"
            />
            {showName && (
                <span
                    className={
                        nameClassName ||
                        'text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate'
                    }
                >
                    {platformName}
                </span>
            )}
        </span>
    );

    if (unlinked) {
        return image;
    }

    return (
        <Link to={linkTo} className="inline-flex items-center gap-2 sm:gap-3 min-w-0 hover:opacity-90 transition-opacity">
            {image}
        </Link>
    );
};

export default BrandLogo;
