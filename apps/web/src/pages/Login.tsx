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
    const { userProfile } = useAuth();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await signInWithEmailAndPassword(auth, email, password);
            if (userProfile?.role === 'admin') {
                navigate('/admin');
            } else {
                navigate('/home');
            }
        } catch (err: any) {
            setError(err.message || 'Error al iniciar sesi\u00f3n');
        }
    };

    return (
        <div className="container">
            <h2>Iniciar Sesión</h2>
            {error && <p className="error-msg">{error}</p>}
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
