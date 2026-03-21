import { useLogto } from '@logto/react';
import { useState, useEffect, useCallback } from 'react';

export function useAuth() {
  const { isAuthenticated, getIdTokenClaims, getAccessToken, signIn, signOut } = useLogto();
  const [userId, setUserId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setUserId(null);
      setToken(null);
      return;
    }
    getIdTokenClaims().then((claims) => setUserId(claims?.sub ?? null));
    getAccessToken(import.meta.env.VITE_LOGTO_API_RESOURCE).then(setToken);
  }, [isAuthenticated, getIdTokenClaims, getAccessToken]);

  const handleSignIn = useCallback(() => {
    signIn(`${window.location.origin}/callback`);
  }, [signIn]);

  const handleSignOut = useCallback(() => {
    signOut(`${window.location.origin}/`);
  }, [signOut]);

  return { userId, token, isAuthenticated, signIn: handleSignIn, signOut: handleSignOut };
}
