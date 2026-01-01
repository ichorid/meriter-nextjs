'use client';

import React, { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useUserRoles, useUpdateUser } from '@/hooks/api/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { useToastStore } from '@/shared/stores/toast.store';
import { UserForm, UserFormData } from '@/components/organisms/UserForm';

interface ProfileEditFormProps {
  onCancel: () => void;
  onSuccess?: () => void;
}

export function ProfileEditForm({ onCancel, onSuccess }: ProfileEditFormProps) {
  const t = useTranslations('profile');
  const { user } = useAuth();
  const addToast = useToastStore((state) => state.addToast);
  const { data: userRoles = [] } = useUserRoles(user?.id || '');

  // Check if user is Representative (lead) or Member (participant)
  const isRepresentativeOrMember = useMemo(() => {
    if (!user) return false;
    if (user.globalRole === 'superadmin') return true; // Organizer
    return userRoles.some(role => role.role === 'lead' || role.role === 'participant');
  }, [user, userRoles]);

  const showContacts = useMemo(() => {
    return user?.globalRole === 'superadmin' || userRoles.some(r => r.role === 'lead');
  }, [user, userRoles]);

  const { mutateAsync: updateUser, isPending: isUpdating } = useUpdateUser();

  const initialData: Partial<UserFormData> = {
    displayName: user?.displayName,
    avatarUrl: user?.avatarUrl,
    bio: user?.profile?.bio,
    location: user?.profile?.location,
    website: user?.profile?.website,
    about: user?.profile?.about,
    contacts: {
      email: user?.profile?.contacts?.email || '', // Email is in profile.contacts
      other: user?.profile?.contacts?.messenger,
    },
    educationalInstitution: user?.profile?.educationalInstitution,
  };

  const handleSubmit = async (data: UserFormData) => {
    try {
      await updateUser({
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        profile: {
          bio: data.bio,
          location: data.location,
          website: data.website,
          about: data.about,
          contacts: {
            messenger: data.contacts?.other,
          },
          educationalInstitution: data.educationalInstitution,
        },
      });
      addToast(t('saved'), 'success');
      onSuccess?.();
    } catch (error) {
      console.error('Failed to update profile:', error);
      addToast(t('error'), 'error');
    }
  };

  return (
    <UserForm
      initialData={initialData}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      isSubmitting={isUpdating}
      showContacts={true}
      showEducation={true}
      title={t('editProfile')}
      subtitle={t('editProfileSubtitle')}
    />
  );
}
