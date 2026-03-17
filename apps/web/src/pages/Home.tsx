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
        <div style={{ padding: 20 }}>
            <h1>Panel de Estudiante</h1>
            <p>Bienvenido, {userProfile?.email}</p>
            
            <div style={{ marginTop: 30 }}>
                <h2>Pr\u00e1ctica</h2>
                <button 
                  onClick={() => navigate('/units')} 
                  style={{ 
                    padding: '15px 30px', 
                    fontSize: '1.2rem', 
                    cursor: 'pointer', 
                    background: '#4CAF50', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: 8 
                  }}
                >
                  Ir a Practicar por Unidades
                </button>
            </div>

            <div style={{ marginTop: 50 }}>
                <button onClick={handleLogout} style={{ padding: '8px 16px', background: '#ccc', border: 'none', cursor: 'pointer' }}>Cerrar sesi\u00f3n</button>
            </div>
        </div>
    );
};
