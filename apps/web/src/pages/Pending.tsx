import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { useNavigate, Navigate } from 'react-router-dom';

export const Pending = () => {
    const { currentUser, userProfile } = useAuth();
    const navigate = useNavigate();

    // If no user is logged in, redirect
    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }

    // If user is already approved, send them to their dashboard
    if (userProfile?.role === 'student') {
        return <Navigate to="/home" replace />;
    }
    
    if (userProfile?.role === 'admin') {
        return <Navigate to="/admin" replace />;
    }

    const handleLogout = () => {
        auth.signOut();
        navigate('/login');
    };

    return (
        <div className="container" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: 20 }}>⏳</div>
            <h2>Cuenta en Revisión</h2>
            <p style={{ marginTop: 20, fontSize: '1.1rem', color: 'var(--text-main)' }}>
                Hola <strong>{userProfile?.email || currentUser.email}</strong>, tu cuenta ha sido creada exitosamente.
            </p>
            <p style={{ marginTop: 10, color: 'var(--text-muted)' }}>
                Para acceder a la plataforma, un administrador debe aprobar tu solicitud manualmente. Por favor, vuelve a ingresar más tarde.
            </p>
            
            <button 
                onClick={handleLogout} 
                className="link-btn" 
                style={{ background: 'none', border: 'none', width: 'auto', margin: '40px auto 0', padding: 0 }}
            >
                Cerrar Sesión y Volver
            </button>
        </div>
    );
};
