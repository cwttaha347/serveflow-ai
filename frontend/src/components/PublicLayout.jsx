import { Outlet } from 'react-router-dom';
import PublicNavbar from './PublicNavbar';
import PublicFooter from './PublicFooter';

const PublicLayout = ({ transparentNav = false }) => {
    return (
        <div className="min-h-screen flex flex-col">
            <PublicNavbar transparent={transparentNav} />
            <main className="flex-grow">
                <Outlet />
            </main>
            <PublicFooter />
        </div>
    );
};

export default PublicLayout;
