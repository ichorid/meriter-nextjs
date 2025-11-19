'use client';

import { LoginForm } from '@/components/LoginForm';
import { VersionDisplay } from '@/components/organisms';
// Gluestack UI components
import { Box } from '@/components/ui/box';
import { Center } from '@/components/ui/center';

const PageMeriterLogin = () => {
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