import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
    allowedRole?: 'admin' | 'student';
}

export const ProtectedRoute = ({ allowedRole }: ProtectedRouteProps) => {
    const { currentUser, userProfile, loading } = useAuth();

    if (loading) return <div>Cargando...</div>;

    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRole && userProfile?.role !== allowedRole) {
        if (userProfile?.role === 'pending') {
            return <Navigate to="/pending" replace />;
        }
        return <Navigate to={userProfile?.role === 'admin' ? '/admin' : '/home'} replace />;
    }

    return <Outlet />;
};
