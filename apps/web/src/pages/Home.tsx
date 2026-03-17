import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';

export const Home = () => {
    const { userProfile } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        auth.signOut();
    };

    return (
        <div className="container">
            <h1>Panel de Estudiante</h1>
            <p>Bienvenido, <strong>{userProfile?.email}</strong></p>
            
            <div style={{ marginTop: 30 }} className="flex-col">
                <h3>Práctica Inteligente</h3>
                <button onClick={() => navigate('/dashboard')}>
                    Mi Progreso y Cumplimiento
                </button>
                <button onClick={() => navigate('/friday')} style={{ background: 'var(--secondary)' }}>
                    Examen de Viernes
                </button>
                <button onClick={() => navigate('/units')} style={{ background: 'var(--accent)' }}>
                    Ir a Practicar por Unidades
                </button>
            </div>

            <div style={{ marginTop: 40 }}>
                <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                    Cerrar sesión
                </button>
            </div>
        </div>
    );
};
