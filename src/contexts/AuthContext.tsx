'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged, signInWithPopup, signOut as fbSignOut,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;                         // 初期化中フラグ
  googleAccessToken: string | null;         // Calendar API用OAuthトークン
  signInWithGoogle: () => Promise<void>;    // ログイン（カレンダースコープ付き）
  signOut: () => Promise<void>;
  refreshToken: () => Promise<string | null>; // トークン再取得
}

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true, googleAccessToken: null,
  signInWithGoogle: async () => {}, signOut: async () => {},
  refreshToken: async () => null,
});

export const useAuth = () => useContext(AuthContext);

/* Googleプロバイダー生成（コンポーネント外でstableな参照を確保） */
function makeGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
  provider.setCustomParameters({ prompt: 'consent' });
  return provider;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  /* Firebase Auth 状態を購読 */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  /* Google ログイン（Calendar read-only スコープ付き） */
  const signInWithGoogle = useCallback(async () => {
    const result = await signInWithPopup(auth, makeGoogleProvider());
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) setGoogleAccessToken(credential.accessToken);
  }, []);

  /* トークン再取得（期限切れ時用） */
  const refreshToken = useCallback(async () => {
    const result = await signInWithPopup(auth, makeGoogleProvider());
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setGoogleAccessToken(credential.accessToken);
      return credential.accessToken;
    }
    return null;
  }, []);

  /* ログアウト */
  const signOut = useCallback(async () => {
    await fbSignOut(auth);
    setGoogleAccessToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, googleAccessToken, signInWithGoogle, signOut, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
}
