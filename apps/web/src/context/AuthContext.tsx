import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type Role = 'admin' | 'student';

export interface UserProfile {
    uid: string;
    email: string | null;
    role: Role;
    groupId?: string;
}

interface AuthContextType {
    currentUser: User | null;
    userProfile: UserProfile | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    currentUser: null,
    userProfile: null,
    loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (user) {
                // Admin UID from env or fixed for this project
                const ADMIN_UID = import.meta.env.VITE_ADMIN_UID || 'P3jG9xL2...'; // Fallback logic
                
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);

                let profile: UserProfile;
                
                if (userDoc.exists()) {
                    profile = userDoc.data() as UserProfile;
                    // Force admin role if UID matches, even if Firestore says otherwise (for recovery)
                    if (user.uid === ADMIN_UID && profile.role !== 'admin') {
                        profile.role = 'admin';
                        await setDoc(userDocRef, { role: 'admin' }, { merge: true });
                    }
                } else {
                    // Create initial user profile
                    profile = {
                        uid: user.uid,
                        email: user.email,
                        role: user.uid === ADMIN_UID ? 'admin' : 'student',
                    };
                    await setDoc(userDocRef, profile);
                }
                setUserProfile(profile);
            } else {
                setUserProfile(null);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    return (
        <AuthContext.Provider value={{ currentUser, userProfile, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
