'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useUpdateProfile, useUserRoles } from '@/hooks/api/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import {
  BrandButton,
  BrandInput,
  BrandFormControl,
} from '@/components/ui';
import { Loader2 } from 'lucide-react';
import { useToastStore } from '@/shared/stores/toast.store';

interface ProfileEditFormProps {
  onCancel: () => void;
  onSuccess?: () => void;
}

export function ProfileEditForm({ onCancel, onSuccess }: ProfileEditFormProps) {
  const t = useTranslations('profile');
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();
  const addToast = useToastStore((state) => state.addToast);
  const { data: userRoles = [] } = useUserRoles(user?.id || '');

  // Check if user is Representative (lead) or Member (participant)
  const isRepresentativeOrMember = useMemo(() => {
    if (!user) return false;
    if (user.globalRole === 'superadmin') return true; // Organizer
    return userRoles.some(role => role.role === 'lead' || role.role === 'participant');
  }, [user, userRoles]);

  const [bio, setBio] = useState(user?.profile?.bio || '');
  const [region, setRegion] = useState(user?.profile?.location?.region || '');
  const [city, setCity] = useState(user?.profile?.location?.city || '');
  const [website, setWebsite] = useState(user?.profile?.website || '');
  const [values, setValues] = useState(user?.profile?.values || '');
  const [about, setAbout] = useState(user?.profile?.about || '');
  const [email, setEmail] = useState(user?.profile?.contacts?.email || '');
  const [messenger, setMessenger] = useState(user?.profile?.contacts?.messenger || '');
  const [educationalInstitution, setEducationalInstitution] = useState(user?.profile?.educationalInstitution || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (user) {
      setBio(user.profile?.bio || '');
      setRegion(user.profile?.location?.region || '');
      setCity(user.profile?.location?.city || '');
      setWebsite(user.profile?.website || '');
      setValues(user.profile?.values || '');
      setAbout(user.profile?.about || '');
      setEmail(user.profile?.contacts?.email || '');
      setMessenger(user.profile?.contacts?.messenger || '');
      setEducationalInstitution(user.profile?.educationalInstitution || '');
    }
  }, [user]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (bio.length > 1000) {
      newErrors.bio = t('errors.bioTooLong', { max: 1000 });
    }
    if (values.length > 1000) {
      newErrors.values = t('errors.valuesTooLong', { max: 1000 });
    }
    if (about.length > 1000) {
      newErrors.about = t('errors.aboutTooLong', { max: 1000 });
    }
    if (educationalInstitution.length > 200) {
      newErrors.educationalInstitution = t('errors.educationalInstitutionTooLong', { max: 200 });
    }
    if (website && !isValidUrl(website)) {
      newErrors.website = t('errors.invalidUrl');
    }
    if (email && !isValidEmail(email)) {
      newErrors.email = t('errors.invalidEmail');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    try {
      await updateProfile.mutateAsync({
        bio: bio.trim() || null,
        location: (region.trim() || city.trim()) ? {
          region: region.trim(),
          city: city.trim(),
        } : null,
        website: website.trim() || null,
        values: values.trim() || null,
        about: about.trim() || null,
        contacts: (email.trim() || messenger.trim()) ? {
          email: email.trim() || '',
          messenger: messenger.trim() || '',
        } : null,
        educationalInstitution: educationalInstitution.trim() || null,
      });

      addToast(t('saved'), 'success');
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      addToast(error?.message || t('error'), 'error');
    }
  };

  return (
    <div className="w-full max-w-full overflow-hidden space-y-6">
      <BrandFormControl
        label={t('bio')}
        helperText={`${bio.length}/1000 ${t('characters')}`}
        error={errors.bio}
      >
        <textarea
          className="w-full px-4 py-2 border rounded-xl resize-none"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={t('bioPlaceholder')}
          maxLength={1000}
          rows={4}
        />
      </BrandFormControl>

      <div className="space-y-3">
        <h3 className="font-bold text-base">{t('location')}</h3>
        <BrandFormControl
          label={t('region')}
          error={errors.region}
        >
          <BrandInput
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder={t('regionPlaceholder')}
          />
        </BrandFormControl>
        <BrandFormControl
          label={t('city')}
          error={errors.city}
        >
          <BrandInput
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={t('cityPlaceholder')}
          />
        </BrandFormControl>
      </div>

      <BrandFormControl
        label={t('website')}
        error={errors.website}
      >
        <BrandInput
          type="url"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder={t('websitePlaceholder')}
        />
      </BrandFormControl>

      <BrandFormControl
        label={t('values')}
        helperText={`${values.length}/1000 ${t('characters')}`}
        error={errors.values}
      >
        <textarea
          className="w-full px-4 py-2 border rounded-xl resize-none"
          value={values}
          onChange={(e) => setValues(e.target.value)}
          placeholder={t('valuesPlaceholder')}
          maxLength={1000}
          rows={4}
        />
      </BrandFormControl>

      <BrandFormControl
        label={t('about')}
        helperText={`${about.length}/1000 ${t('characters')}`}
        error={errors.about}
      >
        <textarea
          className="w-full px-4 py-2 border rounded-xl resize-none"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          placeholder={t('aboutPlaceholder')}
          maxLength={1000}
          rows={4}
        />
      </BrandFormControl>

      {/* Educational Institution - only for Representative and Member */}
      {isRepresentativeOrMember && (
        <BrandFormControl
          label={t('educationalInstitution')}
          helperText={t('educationalInstitutionHelper')}
          error={errors.educationalInstitution}
        >
          <BrandInput
            value={educationalInstitution}
            onChange={(e) => setEducationalInstitution(e.target.value)}
            placeholder={t('educationalInstitutionPlaceholder')}
            maxLength={200}
          />
        </BrandFormControl>
      )}

      {/* Contacts - only for Representative and Organizer */}
      {(user?.globalRole === 'superadmin' || userRoles.some(r => r.role === 'lead')) && (
        <div className="space-y-3">
          <h3 className="font-bold text-base">{t('contacts')}</h3>
        <BrandFormControl
          label={t('email')}
          error={errors.email}
        >
          <BrandInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
          />
        </BrandFormControl>
          <BrandFormControl
            label={t('messenger')}
          >
            <BrandInput
              value={messenger}
              onChange={(e) => setMessenger(e.target.value)}
              placeholder={t('messengerPlaceholder')}
            />
          </BrandFormControl>
        </div>
      )}

      <div className="flex gap-4 justify-end">
        <BrandButton
          variant="outline"
          onClick={onCancel}
          disabled={updateProfile.isPending}
        >
          {t('cancel')}
        </BrandButton>
        <BrandButton
          onClick={handleSubmit}
          disabled={updateProfile.isPending}
          isLoading={updateProfile.isPending}
          leftIcon={updateProfile.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
        >
          {updateProfile.isPending ? t('saving') : t('save')}
        </BrandButton>
      </div>
    </div>
  );
}
