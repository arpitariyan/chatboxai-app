import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile as updateFirebaseProfile,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  GithubAuthProvider,
  OAuthProvider,
  User,
} from 'firebase/auth';
import {
  auth,
  googleProvider,
  githubProvider,
  microsoftProvider,
} from '@/config/firebase';
import { getCanonicalUserByEmail, UserProfile } from '@/services/userService';
import {
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
  sendSignupOtp,
  verifySignupOtp,
} from '@/services/otpService';
import { usePreferencesStore } from '@/stores/usePreferencesStore';

WebBrowser.maybeCompleteAuthSession();

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  authError: string | null;
  setAuthError: (error: string | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signInWithSocial: (provider: 'google' | 'github' | 'microsoft') => Promise<void>;
  requestSignUpOtp: (email: string) => Promise<{ success: boolean; devOtp?: string }>;
  confirmSignUpOtp: (email: string, otp: string, password?: string, displayName?: string) => Promise<boolean>;
  requestPasswordResetOtp: (email: string) => Promise<{ success: boolean; devOtp?: string }>;
  confirmPasswordResetOtp: (email: string, otp: string, newPassword?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Sync profile from Appwrite database whenever Firebase user changes
  const fetchAndSyncProfile = async (user: User | null): Promise<UserProfile | null> => {
    if (!user || !user.email) {
      setUserProfile(null);
      return null;
    }
    try {
      const profile = await getCanonicalUserByEmail(
        user.email,
        user.displayName || undefined,
        true
      );
      setUserProfile(profile);
      if (profile) {
        usePreferencesStore.getState().syncFromUserProfile(profile);
      }
      return profile || null;
    } catch (err: any) {
      console.warn('[AuthProvider] Failed to sync Appwrite profile:', err?.message || err);
      return null;
    }
  };

  // Automatically re-sync profile and active subscription from database whenever the app returns to foreground
  // (e.g. after the user completes payment on chatboxai.co.in in the browser)
  useEffect(() => {
    let lastSyncTimestamp = 0;
    const subscription = AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        const now = Date.now();
        // Throttle auto-sync to at most once every 2 seconds
        if (now - lastSyncTimestamp > 2000) {
          lastSyncTimestamp = now;
          const user = auth.currentUser || currentUser;
          if (user) {
            console.log('[AuthProvider] App resumed to active state: auto-syncing subscription and profile...');
            await fetchAndSyncProfile(user);
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [currentUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchAndSyncProfile(user);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setAuthError(null);
    try {
      const result = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (result.user) {
        setCurrentUser(result.user);
        await fetchAndSyncProfile(result.user);
      }
    } catch (err: any) {
      const errorMsg = formatFirebaseAuthError(err);
      setAuthError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    setAuthError(null);
    try {
      const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (result.user) {
        if (displayName && displayName.trim()) {
          await updateFirebaseProfile(result.user, { displayName: displayName.trim() });
        }
        setCurrentUser(result.user);
        await fetchAndSyncProfile(result.user);
      }
    } catch (err: any) {
      const errorMsg = formatFirebaseAuthError(err);
      setAuthError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  const signInWithSocial = async (providerName: 'google' | 'github' | 'microsoft') => {
    setAuthError(null);
    try {
      // Web platform: use Firebase popup
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        let webProvider;
        if (providerName === 'google') webProvider = googleProvider;
        else if (providerName === 'github') webProvider = githubProvider;
        else webProvider = microsoftProvider;
        const result = await signInWithPopup(auth, webProvider);
        if (result.user) {
          setCurrentUser(result.user);
          await fetchAndSyncProfile(result.user);
        }
        return;
      }

      // Mobile platform: Route OAuth through Firebase's own auth handler domain.
      // This avoids registering custom scheme redirect URIs in each OAuth provider.
      // Firebase auth domain is always whitelisted: https://craetionai.firebaseapp.com/__/auth/handler
      const firebaseAuthDomain =
        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'craetionai.firebaseapp.com';

      // The redirect URI is Firebase's own handler — always valid, no console registration needed
      const firebaseRedirect = `https://${firebaseAuthDomain}/__/auth/handler`;

      let authUrl = '';

      if (providerName === 'google') {
        // Use Web Client ID (type 3 in google-services.json)
        const googleWebClientId =
          process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
          '383236597748-0a61e6av5qtk4tdjikmgeokh902e2prh.apps.googleusercontent.com';
        const nonce = Math.random().toString(36).substring(2, 18);
        authUrl =
          `https://accounts.google.com/o/oauth2/v2/auth` +
          `?client_id=${encodeURIComponent(googleWebClientId)}` +
          `&redirect_uri=${encodeURIComponent(firebaseRedirect)}` +
          `&response_type=id_token%20token` +
          `&scope=${encodeURIComponent('openid email profile')}` +
          `&prompt=select_account` +
          `&nonce=${encodeURIComponent(nonce)}`;
      } else if (providerName === 'github') {
        const githubClientId =
          process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID || '';
        if (!githubClientId) {
          throw new Error(
            'GitHub OAuth App Client ID is not configured. Please add EXPO_PUBLIC_GITHUB_CLIENT_ID to your .env file.'
          );
        }
        authUrl =
          `https://github.com/login/oauth/authorize` +
          `?client_id=${encodeURIComponent(githubClientId)}` +
          `&redirect_uri=${encodeURIComponent(firebaseRedirect)}` +
          `&scope=user:email`;
      } else {
        // Microsoft
        const msClientId =
          process.env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID || '64a4b37f-310d-4d8c-827f-f7e73e8398d8';
        const nonce = Math.random().toString(36).substring(2, 18);
        authUrl =
          `https://login.microsoftonline.com/common/oauth2/v2.0/authorize` +
          `?client_id=${encodeURIComponent(msClientId)}` +
          `&redirect_uri=${encodeURIComponent(firebaseRedirect)}` +
          `&response_type=id_token%20token` +
          `&scope=${encodeURIComponent('openid email profile')}` +
          `&prompt=select_account` +
          `&nonce=${encodeURIComponent(nonce)}`;
      }

      // Open browser and wait for Firebase redirect to return
      const sessionResult = await WebBrowser.openAuthSessionAsync(
        authUrl,
        firebaseRedirect
      );

      if (sessionResult.type === 'dismiss' || sessionResult.type === 'cancel') {
        return; // Natural user cancel — no error banner
      }

      if (sessionResult.type === 'success' && sessionResult.url) {
        const rawUrl = sessionResult.url;
        // Parse both hash (#) and query (?) fragments from returned URL
        const hashStr = rawUrl.includes('#') ? rawUrl.split('#')[1] : '';
        const queryStr = rawUrl.includes('?') ? rawUrl.split('?')[1].split('#')[0] : '';
        const hashParams = new URLSearchParams(hashStr);
        const queryParams = new URLSearchParams(queryStr);

        const idToken = hashParams.get('id_token') || queryParams.get('id_token');
        const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
        const oauthError = hashParams.get('error') || queryParams.get('error');

        if (oauthError) {
          const errDesc =
            hashParams.get('error_description') ||
            queryParams.get('error_description') ||
            oauthError;
          throw new Error(`Sign-in failed: ${decodeURIComponent(errDesc.replace(/\+/g, ' '))}`);
        }

        if (idToken || accessToken) {
          let credential;
          if (providerName === 'google') {
            credential = GoogleAuthProvider.credential(idToken || null, accessToken || null);
          } else if (providerName === 'github') {
            credential = GithubAuthProvider.credential(accessToken || '');
          } else {
            const oauthProv = new OAuthProvider('microsoft.com');
            credential = oauthProv.credential({
              idToken: idToken || undefined,
              accessToken: accessToken || undefined,
            });
          }
          const userCredential = await signInWithCredential(auth, credential);
          if (userCredential.user) {
            setCurrentUser(userCredential.user);
            await fetchAndSyncProfile(userCredential.user);
            return;
          }
        }
      }

      throw new Error(
        `Sign-in with ${providerName.charAt(0).toUpperCase() + providerName.slice(1)} was not completed. Please try again.`
      );
    } catch (err: any) {
      const errorMsg = formatFirebaseAuthError(err);
      setAuthError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  const requestSignUpOtp = async (email: string) => {
    setAuthError(null);
    try {
      return await sendSignupOtp(email);
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to send confirmation code';
      setAuthError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  const confirmSignUpOtp = async (
    email: string,
    otp: string,
    password?: string,
    displayName?: string
  ) => {
    setAuthError(null);
    try {
      const isValid = await verifySignupOtp(email, otp);
      if (!isValid) {
        throw new Error('Invalid confirmation code');
      }

      // If user is not yet logged in with Firebase, sign them in or create account
      if (!auth.currentUser && password) {
        try {
          const res = await createUserWithEmailAndPassword(auth, email.trim(), password);
          if (res.user && displayName?.trim()) {
            await updateFirebaseProfile(res.user, { displayName: displayName.trim() });
          }
          await fetchAndSyncProfile(res.user);
        } catch (e: any) {
          if (e?.code === 'auth/email-already-in-use') {
            const res = await signInWithEmailAndPassword(auth, email.trim(), password);
            await fetchAndSyncProfile(res.user);
          } else {
            throw e;
          }
        }
      } else if (auth.currentUser) {
        await fetchAndSyncProfile(auth.currentUser);
      }

      return true;
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to verify confirmation code';
      setAuthError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  const requestPasswordResetOtp = async (email: string) => {
    setAuthError(null);
    try {
      return await sendPasswordResetOtp(email);
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to send reset email';
      setAuthError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  const confirmPasswordResetOtp = async (email: string, otp: string, newPassword?: string) => {
    setAuthError(null);
    try {
      return await verifyPasswordResetOtp(email, otp, newPassword);
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to verify reset code';
      setAuthError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  const logout = async () => {
    setAuthError(null);
    try {
      await signOut(auth);
    } catch (err: any) {
      console.warn('[AuthProvider] Sign out error:', err);
    } finally {
      setCurrentUser(null);
      setUserProfile(null);
    }
  };

  const refreshProfile = async (): Promise<UserProfile | null> => {
    const user = auth.currentUser || currentUser;
    if (user) {
      return await fetchAndSyncProfile(user);
    }
    return null;
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        authError,
        setAuthError,
        signIn,
        signUp,
        signInWithSocial,
        requestSignUpOtp,
        confirmSignUpOtp,
        requestPasswordResetOtp,
        confirmPasswordResetOtp,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Format raw error codes into friendly human-readable error messages
 */
function formatFirebaseAuthError(error: any): string {
  const message = String(error?.message || error || '').toLowerCase();
  const code = error?.code || '';

  if (code === 'auth/popup-closed-by-user' || message.includes('cancelled') || message.includes('cancel')) {
    return 'Sign-in was cancelled.';
  }

  switch (code) {
    case 'auth/invalid-email':
      return 'Invalid email address format.';
    case 'auth/user-disabled':
      return 'This user account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found with this email address.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/network-request-failed':
      return 'Network connection failed. Please check your internet connection.';
    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Please try again later.';
    default:
      return error?.message || 'Authentication failed. Please try again.';
  }
}
