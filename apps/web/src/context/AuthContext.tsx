import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export type Role = 'admin' | 'student' | 'pending';

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
    loginWithGoogle: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType>({
    currentUser: null,
    userProfile: null,
    loading: true,
    loginWithGoogle: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    const loginWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        return signInWithPopup(auth, provider);
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (user) {
                const isSuperAdmin = user.email?.toLowerCase() === 'nicolas.ayelef@gmail.com';
                
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);

                let profile: UserProfile;
                
                if (userDoc.exists()) {
                    profile = userDoc.data() as UserProfile;
                    // Force admin role if UID matches, even if Firestore says otherwise (for recovery)
                    if (isSuperAdmin && profile.role !== 'admin') {
                        profile.role = 'admin';
                        await setDoc(userDocRef, { role: 'admin' }, { merge: true });
                    }
                } else {
                    // Create initial user profile
                    profile = {
                        uid: user.uid,
                        email: user.email,
                        role: isSuperAdmin ? 'admin' : 'pending',
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
        <AuthContext.Provider value={{ currentUser, userProfile, loading, loginWithGoogle }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
