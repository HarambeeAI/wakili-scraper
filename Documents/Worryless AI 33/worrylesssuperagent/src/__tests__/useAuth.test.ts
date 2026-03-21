import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock @logto/react before importing useAuth
const mockSignIn = vi.fn();
const mockSignOut = vi.fn();
const mockGetIdTokenClaims = vi.fn();
const mockGetAccessToken = vi.fn();

vi.mock('@logto/react', () => ({
  useLogto: vi.fn(() => ({
    isAuthenticated: false,
    getIdTokenClaims: mockGetIdTokenClaims,
    getAccessToken: mockGetAccessToken,
    signIn: mockSignIn,
    signOut: mockSignOut,
  })),
}));

import { useLogto } from '@logto/react';
import { useAuth } from '@/hooks/useAuth';

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetIdTokenClaims.mockResolvedValue(null);
    mockGetAccessToken.mockResolvedValue(null);
  });

  it('returns isAuthenticated=false and userId=null when user is not signed in', () => {
    (useLogto as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: false,
      getIdTokenClaims: mockGetIdTokenClaims,
      getAccessToken: mockGetAccessToken,
      signIn: mockSignIn,
      signOut: mockSignOut,
    });

    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.userId).toBeNull();
  });

  it('returns userId matching the sub claim when user is authenticated', async () => {
    mockGetIdTokenClaims.mockResolvedValue({ sub: 'user-123-test' });
    mockGetAccessToken.mockResolvedValue('mock-jwt-token');

    (useLogto as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: true,
      getIdTokenClaims: mockGetIdTokenClaims,
      getAccessToken: mockGetAccessToken,
      signIn: mockSignIn,
      signOut: mockSignOut,
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.userId).toBe('user-123-test');
    });
  });

  it('returns a non-null token when user is authenticated', async () => {
    mockGetIdTokenClaims.mockResolvedValue({ sub: 'user-456' });
    mockGetAccessToken.mockResolvedValue('mock-jwt-token');

    (useLogto as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: true,
      getIdTokenClaims: mockGetIdTokenClaims,
      getAccessToken: mockGetAccessToken,
      signIn: mockSignIn,
      signOut: mockSignOut,
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.token).toBe('mock-jwt-token');
    });
  });

  it('signIn callback calls signIn with the correct redirect URI containing /callback', () => {
    (useLogto as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: false,
      getIdTokenClaims: mockGetIdTokenClaims,
      getAccessToken: mockGetAccessToken,
      signIn: mockSignIn,
      signOut: mockSignOut,
    });

    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.signIn();
    });

    expect(mockSignIn).toHaveBeenCalledWith(
      expect.stringContaining('/callback')
    );
  });

  it('signOut callback calls signOut with the correct post-logout redirect URI', () => {
    (useLogto as ReturnType<typeof vi.fn>).mockReturnValue({
      isAuthenticated: true,
      getIdTokenClaims: mockGetIdTokenClaims,
      getAccessToken: mockGetAccessToken,
      signIn: mockSignIn,
      signOut: mockSignOut,
    });

    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalledWith(
      expect.stringContaining('/')
    );
  });
});
