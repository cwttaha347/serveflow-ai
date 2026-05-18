import { Link } from 'react-router-dom';
import { LOGO_SRC } from './BrandLogo';

/**
 * Compact rounded ServeFlow mark for dashboard chrome and page headers.
 */
const DashboardBrand = ({
    linkTo,
    className = '',
    imageClassName = '',
    unlinked = false,
}) => {
    const mark = (
        <span
            className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-white/90 dark:bg-slate-800/90 p-1.5 sm:p-2 border border-slate-200/70 dark:border-white/10 shadow-sm ${className}`}
        >
            <img
                src={LOGO_SRC}
                alt="ServeFlow"
                className={`h-8 w-auto max-h-8 sm:h-9 sm:max-h-9 lg:h-10 lg:max-h-10 object-contain select-none dark:brightness-110 ${imageClassName}`}
                decoding="async"
            />
        </span>
    );

    if (unlinked || !linkTo) {
        return mark;
    }

    return (
        <Link to={linkTo} className="inline-flex hover:opacity-90 transition-opacity" aria-label="ServeFlow dashboard home">
            {mark}
        </Link>
    );
};

export default DashboardBrand;
