import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';

export const Admin = () => {
    const { userProfile } = useAuth();

    const handleLogout = () => {
        auth.signOut();
    };

    return (
        <div style={{ padding: 20 }}>
            <h1>Panel de Administrador</h1>
            <p>Bienvenido, Administrador {userProfile?.email}</p>
            <p>Este es un espacio restringido exclusivo para cuentas con rol 'admin'.</p>
            <button onClick={handleLogout}>Cerrar sesi\u00f3n</button>
        </div>
    );
};
