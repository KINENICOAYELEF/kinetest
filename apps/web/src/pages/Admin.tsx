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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                    <button 
                        onClick={() => navigate('/admin/dashboard')}
                        style={{ background: 'var(--accent)', padding: '16px', fontWeight: 'bold' }}
                    >
                        📊 Ver Estadísticas Estudiantes
                    </button>
                    
                    <button 
                        onClick={() => navigate('/admin/units')} 
                        style={{ background: '#3b82f6', padding: '16px', fontWeight: 'bold', border: '2px solid white' }}
                    >
                        📁 Gestionar Unidades (Visibilidad On/Off)
                    </button>
                    
                    <button 
                        onClick={() => navigate('/admin/content')} 
                        style={{ background: '#f59e0b', padding: '16px', fontWeight: 'bold', border: '2px solid white' }}
                    >
                        ✍️ Gestionar Contenido (Aprobar Preguntas)
                    </button>
                    
                    <div style={{ height: 1, background: 'var(--glass-border)', margin: '10px 0' }}></div>
                    
                    <button onClick={handleLogout} className="link-btn" style={{ background: 'rgba(248, 113, 113, 0.1)', border: '1px solid #f87171', color: '#f87171', padding: '10px' }}>
                        Cerrar sesión
                    </button>
                </div>
            </div>
        </div>
    );
};
