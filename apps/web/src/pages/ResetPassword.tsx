import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Link } from 'react-router-dom';
import { auth } from '../lib/firebase';

export const ResetPassword = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await sendPasswordResetEmail(auth, email);
            setMessage('Correo enviado. Revisa tu bandeja de entrada.');
            setError('');
        } catch (err: any) {
            setError(err.message || 'Error al restablecer la contrase\u00f1a');
            setMessage('');
        }
    };

    return (
        <div className="container" style={{ maxWidth: 450, marginTop: '10vh' }}>
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: 40, borderRadius: 24, border: '1px solid var(--glass-border)', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                <h1>Recuperar Contraseña</h1>
                <p style={{ color: 'var(--text-muted)', marginBottom: 30 }}>Te enviaremos un enlace para que puedas volver a entrar.</p>
                
                {message && <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent)', padding: 15, borderRadius: 12, marginBottom: 20, border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.9rem' }}>{message}</div>}
                {error && <div style={{ background: 'rgba(248, 113, 113, 0.1)', color: '#f87171', padding: 15, borderRadius: 12, marginBottom: 20, border: '1px solid rgba(248, 113, 113, 0.2)', fontSize: '0.9rem' }}>{error}</div>}
                
                <form onSubmit={handleReset} className="flex-col" style={{ gap: 16 }}>
                    <div className="input-group">
                        <input
                            type="email"
                            placeholder="Tu correo electrónico"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit">Enviar Enlace de Reseteo</button>
                </form>
                <div style={{ marginTop: 30, textAlign: 'center' }}>
                    <Link to="/login" className="link-btn" style={{ fontSize: '0.9rem' }}>
                        Volver al inicio de sesión
                    </Link>
                </div>
            </div>
        </div>
    );
};
