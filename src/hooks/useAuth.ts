import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth, signOutUser } from "@/lib/firebase";
import { doc, getDoc, getFirestore } from "firebase/firestore";

const db = getFirestore();

interface AuthState {
  user: User | null;
  role: string | null;
  companyId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setRole(data.role || null);
            setCompanyId(data.companyId || null);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      } else {
        setRole(null);
        setCompanyId(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, role, companyId, loading, signOut: signOutUser };
}
