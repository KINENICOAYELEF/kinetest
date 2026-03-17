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
        <div style={{ maxWidth: 400, margin: '100px auto', padding: 20 }}>
            <h2>Restablecer contrase\u00f1a</h2>
            {message && <p style={{ color: 'green' }}>{message}</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                    type="email"
                    placeholder="Correo electr\u00f3nico"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <button type="submit">Enviar Enlace</button>
            </form>
            <div style={{ marginTop: 20 }}>
                <Link to="/login">Volver al inicio de sesi\u00f3n</Link>
            </div>
        </div>
    );
};
