import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { Button } from '@/components/ui/shadcn/button';
import { User } from '@/types/api-v1';
import { useDebounce } from '@/hooks/useDebounce';
import { Loader2 } from 'lucide-react';
import { useSearchUsers, useUpdateGlobalRole } from '@/hooks/api/useUsers';

export const SuperadminManagement = () => {
    const tSearch = useTranslations('search');
    const tSettings = useTranslations('settings');
    const [query, setQuery] = useState('');
    const [message, setMessage] = useState('');

    const debouncedQuery = useDebounce(query, 500);
    const { data: users = [], isLoading } = useSearchUsers(debouncedQuery);
    const updateGlobalRole = useUpdateGlobalRole();

    const handleToggleRole = async (user: User) => {
        const newRole = user.globalRole === 'superadmin' ? 'user' : 'superadmin';
        try {
            const _updatedUser = await updateGlobalRole.mutateAsync({ userId: user.id, role: newRole });
            setMessage(`Successfully ${newRole === 'superadmin' ? 'promoted' : 'demoted'} ${user.displayName}`);
            setTimeout(() => setMessage(''), 3000);
        } catch {
            console.error('Update role error:', error);
            setMessage('Failed to update role');
        }
    };

    return (
        <div className="space-y-4">
            <h2 className="text-base font-semibold text-brand-text-primary dark:text-base-content">
                Superadmin Management
            </h2>

            <div className="space-y-1.5">
                <Label>{tSettings('searchUsers')}</Label>
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={tSearch('results.searchUsersPlaceholder')}
                    className="h-11 rounded-xl w-full"
                />
            </div>

            {isLoading && (
                <div className="flex justify-center p-4">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                </div>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto">
                {users.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                            {user.avatarUrl && (
                                <img src={user.avatarUrl} alt={user.displayName} className="w-8 h-8 rounded-full" />
                            )}
                            <div>
                                <p className="font-medium text-sm text-base-content">{user.displayName}</p>
                                <p className="text-xs text-base-content/60">@{user.username}</p>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            variant={user.globalRole === 'superadmin' ? 'outline' : 'default'}
                            onClick={() => handleToggleRole(user)}
                            className="rounded-xl active:scale-[0.98]"
                        >
                            {user.globalRole === 'superadmin' ? tSettings('removeAdmin') : tSettings('makeAdmin')}
                        </Button>
                    </div>
                ))}
            </div>

            {message && (
                <p className={`text-sm ${message.includes('Failed') ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {message}
                </p>
            )}
        </div>
    );
};