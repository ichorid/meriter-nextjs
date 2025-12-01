import { useState, useEffect } from 'react';
import { usersApiV1 } from '@/lib/api/v1';
import { BrandInput } from '@/components/ui/BrandInput';
import { BrandButton } from '@/components/ui/BrandButton';
import { User } from '@/types/api-v1';
import { useDebounce } from '@/hooks/useDebounce';
import { Loader2 } from 'lucide-react';

export const SuperadminManagement = () => {
    const [query, setQuery] = useState('');
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');

    const debouncedQuery = useDebounce(query, 500);

    useEffect(() => {
        const search = async () => {
            if (debouncedQuery.length >= 2) {
                setIsLoading(true);
                try {
                    const results = await usersApiV1.searchUsers(debouncedQuery);
                    setUsers(results);
                } catch (error) {
                    console.error('Search error:', error);
                } finally {
                    setIsLoading(false);
                }
            } else {
                setUsers([]);
            }
        };
        search();
    }, [debouncedQuery]);

    const handleToggleRole = async (user: User) => {
        const newRole = user.globalRole === 'superadmin' ? 'user' : 'superadmin';
        try {
            const updatedUser = await usersApiV1.updateGlobalRole(user.id, newRole);
            setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
            setMessage(`Successfully ${newRole === 'superadmin' ? 'promoted' : 'demoted'} ${user.displayName}`);
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error('Update role error:', error);
            setMessage('Failed to update role');
        }
    };

    return (
        <div className="space-y-4">
            <h2 className="text-base font-semibold text-brand-text-primary">
                Superadmin Management
            </h2>

            <BrandInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search users by name, username or email..."
                label="Search Users"
            />

            {isLoading && (
                <div className="flex justify-center p-4">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                </div>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto">
                {users.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                            {user.avatarUrl && (
                                <img src={user.avatarUrl} alt={user.displayName} className="w-8 h-8 rounded-full" />
                            )}
                            <div>
                                <p className="font-medium text-sm">{user.displayName}</p>
                                <p className="text-xs text-gray-500">@{user.username}</p>
                            </div>
                        </div>
                        <BrandButton
                            size="sm"
                            variant={user.globalRole === 'superadmin' ? 'outline' : 'primary'}
                            onClick={() => handleToggleRole(user)}
                        >
                            {user.globalRole === 'superadmin' ? 'Remove Admin' : 'Make Admin'}
                        </BrandButton>
                    </div>
                ))}
            </div>

            {message && (
                <p className={`text-sm ${message.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
                    {message}
                </p>
            )}
        </div>
    );
};
