'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import { VersionDisplay } from '@/components/organisms';
import { clearAuthStorage } from '@/lib/utils/auth';
// Gluestack UI components
import { Box } from '@/components/ui/box';
import { Center } from '@/components/ui/center';

const PageMeriterLogin = () => {
    const searchParams = useSearchParams();
    
    // Clear cookies and storage when error param is present (from OAuth callback failures)
    useEffect(() => {
        const error = searchParams?.get('error');
        if (error) {
            // Clear all auth storage to ensure clean state for re-authentication
            clearAuthStorage();
        }
    }, [searchParams]);
    
    return (
        <Box minHeight="100vh" bg="$white" px="$4" py="$8">
            <Center>
                <Box width="100%" maxWidth={448}>
                    <LoginForm />
                    
                    <Center mt="$8">
                        <VersionDisplay />
                    </Center>
                </Box>
            </Center>
        </Box>
    );
};

export default PageMeriterLogin;