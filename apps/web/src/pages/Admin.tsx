import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';

export const Admin = () => {
    const { userProfile } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        auth.signOut();
    };

    return (
        <div className="container" style={{ maxWidth: 600 }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 40, borderRadius: 24, border: '1px solid var(--glass-border)' }}>
                <h1>Panel de Administrador</h1>
                <p style={{ color: 'var(--text-main)', marginBottom: 20 }}>Bienvenido, Administrador {userProfile?.email}</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 30 }}>Este es un espacio restringido exclusivo para cuentas con rol 'admin'.</p>
                <div className="flex-col" style={{ gap: 16 }}>
                    <button onClick={() => navigate('/admin-dashboard')}>Ver Estadísticas Estudiantes</button>
                    <button onClick={handleLogout} className="link-btn" style={{ background: 'none', border: 'none', width: 'auto', margin: '10px auto', color: '#f87171' }}>Cerrar sesión</button>
                </div>
            </div>
        </div>
    );
};
