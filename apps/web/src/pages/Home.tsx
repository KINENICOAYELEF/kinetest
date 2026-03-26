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
                    Mi Pregreso y Cumplimiento
                </button>
                {/* Examen de Viernes desactivado temporalmente — Bible v1 */}
                <button onClick={() => navigate('/units')} style={{ background: 'var(--accent)' }}>
                    Ir a Practicar por Unidades
                </button>

                {userProfile?.role === 'admin' && (
                    <div style={{ marginTop: 24, padding: 20, background: 'rgba(245, 158, 11, 0.1)', borderRadius: 16, border: '1px solid #f59e0b' }}>
                        <h4 style={{ color: '#f59e0b', marginTop: 0 }}>Modo Administrador</h4>
                        <button onClick={() => navigate('/admin')} style={{ background: '#f59e0b', marginTop: 10 }}>
                            Ir al Panel de Control (Aprobaciones)
                        </button>
                    </div>
                )}
            </div>

            <div style={{ marginTop: 40 }}>
                <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)' }}>
                    Cerrar sesión
                </button>
            </div>
        </div>
    );
};
