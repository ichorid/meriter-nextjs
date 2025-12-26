/**
 * Browser console debugging utilities for JWT and authentication
 * 
 * Usage in browser console:
 *   window.debugAuth() - Show current auth state
 *   window.debugCookies() - Show all cookies
 *   window.debugJWT() - Decode and show JWT cookie (if accessible)
 */

if (typeof window !== 'undefined') {
  // Make debug functions available globally in development
  if (process.env.NODE_ENV === 'development') {
    (window as any).debugAuth = () => {
      console.group('🔐 Auth Debug Info');
      
      // Check cookies
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      
      console.log('📦 Cookies:', cookies);
      console.log('🍪 JWT cookie exists:', !!cookies.jwt);
      console.log('🍪 JWT cookie length:', cookies.jwt?.length || 0);
      
      // Check localStorage
      const hasSession = localStorage.getItem('hasPreviousSession') === 'true';
      console.log('💾 Has previous session (localStorage):', hasSession);
      
      // Check current URL
      console.log('🌐 Current URL:', window.location.href);
      console.log('📍 Pathname:', window.location.pathname);
      
      // Try to fetch user info
      console.log('⏳ Fetching user info via tRPC...');
      fetch('/trpc/users.getMe?batch=1&input={"0":{"json":null,"meta":{"values":["undefined"],"v":1}}}', {
        credentials: 'include',
      })
        .then(res => {
          console.log('📡 Response status:', res.status, res.statusText);
          return res.json();
        })
        .then(data => {
          console.log('📡 Response data:', data);
          if (data[0]?.result?.data) {
            console.log('✅ User authenticated:', data[0].result.data);
          } else if (data[0]?.result?.error) {
            console.error('❌ Auth error:', data[0].result.error);
          }
        })
        .catch(err => {
          console.error('❌ Fetch error:', err);
        });
      
      console.groupEnd();
    };

    (window as any).debugCookies = () => {
      console.group('🍪 Cookie Debug Info');
      
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      
      console.log('All cookies:', cookies);
      console.log('Cookie count:', Object.keys(cookies).length);
      
      if (cookies.jwt) {
        console.log('JWT cookie found:', {
          length: cookies.jwt.length,
          first20: cookies.jwt.substring(0, 20),
          last20: cookies.jwt.substring(cookies.jwt.length - 20),
        });
        
        // Try to decode JWT (without verification)
        try {
          const parts = cookies.jwt.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            console.log('JWT payload (decoded):', {
              uid: payload.uid,
              authProvider: payload.authProvider,
              authId: payload.authId,
              iat: payload.iat ? new Date(payload.iat * 1000).toISOString() : 'none',
              exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'none',
              isExpired: payload.exp ? Date.now() > payload.exp * 1000 : 'unknown',
            });
          }
        } catch (e) {
          console.warn('Could not decode JWT:', e);
        }
      } else {
        console.warn('❌ JWT cookie not found in document.cookie');
        console.log('This could mean:');
        console.log('1. Cookie is HttpOnly (not accessible via JavaScript)');
        console.log('2. Cookie was not set');
        console.log('3. Cookie domain/path mismatch');
      }
      
      console.groupEnd();
    };

    (window as any).debugJWT = () => {
      console.group('🔑 JWT Debug');
      
      const cookies = document.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      
      if (!cookies.jwt) {
        console.warn('❌ JWT cookie not found in document.cookie');
        console.log('Note: HttpOnly cookies are not accessible via JavaScript');
        console.log('Check Network tab -> Request Headers -> Cookie header');
        console.groupEnd();
        return;
      }
      
      try {
        const parts = cookies.jwt.split('.');
        if (parts.length !== 3) {
          console.error('Invalid JWT format: expected 3 parts, got', parts.length);
          console.groupEnd();
          return;
        }
        
        const header = JSON.parse(atob(parts[0]));
        const payload = JSON.parse(atob(parts[1]));
        
        console.log('JWT Header:', header);
        console.log('JWT Payload:', {
          uid: payload.uid,
          authProvider: payload.authProvider,
          authId: payload.authId,
          communityTags: payload.communityTags,
          iat: payload.iat ? new Date(payload.iat * 1000).toISOString() : 'none',
          exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : 'none',
          isExpired: payload.exp ? Date.now() > payload.exp * 1000 : 'unknown',
          expiresIn: payload.exp ? `${Math.round((payload.exp * 1000 - Date.now()) / 1000 / 60)} minutes` : 'unknown',
        });
        
        console.log('JWT Signature (last 20 chars):', parts[2].substring(parts[2].length - 20));
        
      } catch (e) {
        console.error('Error decoding JWT:', e);
      }
      
      console.groupEnd();
    };

    (window as any).debugNetwork = () => {
      console.group('🌐 Network Debug');
      console.log('Current origin:', window.location.origin);
      console.log('API base URL (from config):', process.env.NEXT_PUBLIC_API_URL || 'not set (using relative)');
      console.log('tRPC endpoint:', '/trpc');
      
      console.log('\n📡 Testing tRPC connection...');
      fetch('/trpc/users.getMe?batch=1&input={"0":{"json":null,"meta":{"values":["undefined"],"v":1}}}', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      })
        .then(async (res) => {
          console.log('Response status:', res.status, res.statusText);
          console.log('Response headers:', Object.fromEntries(res.headers.entries()));
          
          const data = await res.json();
          console.log('Response body:', data);
          
          // Check Set-Cookie headers (won't be visible, but log what we can)
          const setCookie = res.headers.get('Set-Cookie');
          if (setCookie) {
            console.log('Set-Cookie header:', setCookie);
          }
        })
        .catch(err => {
          console.error('Fetch error:', err);
        });
      
      console.groupEnd();
    };

    console.log('🔧 Auth debug helpers loaded!');
    console.log('Available commands:');
    console.log('  window.debugAuth() - Show auth state and test tRPC');
    console.log('  window.debugCookies() - Show all cookies');
    console.log('  window.debugJWT() - Decode JWT cookie');
    console.log('  window.debugNetwork() - Test network connection');
  }
}

export {};

