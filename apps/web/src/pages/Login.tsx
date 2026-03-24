import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

export const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { userProfile, loginWithGoogle } = useAuth();

    const handleGoogleLogin = async () => {
        try {
            await loginWithGoogle();
        } catch (err: any) {
            setError(err.message || 'Error al iniciar sesión con Google');
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, email, password);
            if (userProfile?.role === 'admin') {
                navigate('/admin');
            } else if (userProfile?.role === 'pending') {
                navigate('/pending');
            } else {
                navigate('/home');
            }
        } catch (err: any) {
            setError(err.message || 'Error al iniciar sesi\u00f3n');
        }
    };

    return (
        <div className="container">
            <h2>Bienvenido a KineTest</h2>
            <p style={{ textAlign: 'center', marginBottom: 30 }}>Ingresa a tu plataforma académica clínica.</p>
            {error && <p className="error-msg">{error}</p>}
            
            <button 
                onClick={handleGoogleLogin} 
                style={{ 
                    background: 'white', 
                    color: '#333', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '10px',
                    marginBottom: '20px'
                }}
            >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: 18 }} />
                Ingresar con Google
            </button>
            
            <div style={{ textAlign: 'center', margin: '20px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                o con correo electrónico
            </div>

            <form onSubmit={handleLogin} className="flex-col">
                <input
                    type="email"
                    placeholder="Correo electrónico"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button type="submit">Ingresar</button>
            </form>
            <div style={{ marginTop: 20 }}>
                <Link to="/reset-password" title="Recuperar acceso">¿Olvidaste tu contraseña?</Link>
            </div>
        </div>
    );
};
