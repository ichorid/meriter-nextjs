import { useTranslations } from 'next-intl';
import type { ImpactArea, Stage, Beneficiary, Method, HelpNeeded } from '@/lib/constants/taxonomy';

/**
 * Hook to translate taxonomy enum values
 * Provides functions to translate impactArea, stage, beneficiaries, methods, and helpNeeded values
 */
export function useTaxonomyTranslations() {
  const tImpactArea = useTranslations('publications.create.taxonomy.values.impactArea');
  const tStage = useTranslations('publications.create.taxonomy.values.stage');
  const tBeneficiaries = useTranslations('publications.create.taxonomy.values.beneficiaries');
  const tMethods = useTranslations('publications.create.taxonomy.values.methods');
  const tHelpNeeded = useTranslations('publications.create.taxonomy.values.helpNeeded');

  const translateImpactArea = (value: ImpactArea | string | undefined | null): string => {
    if (!value) return value || '';
    try {
      const translated = tImpactArea(value as any);
      // If translation returns the same value or starts with the namespace, fallback to original
      return translated && translated !== value ? translated : value;
    } catch {
      return value;
    }
  };

  const translateStage = (value: Stage | string | undefined | null): string => {
    if (!value) return value || '';
    try {
      const translated = tStage(value as any);
      return translated && translated !== value ? translated : value;
    } catch {
      return value;
    }
  };

  const translateBeneficiary = (value: Beneficiary | string | undefined | null): string => {
    if (!value) return value || '';
    try {
      const translated = tBeneficiaries(value as any);
      return translated && translated !== value ? translated : value;
    } catch {
      return value;
    }
  };

  const translateMethod = (value: Method | string | undefined | null): string => {
    if (!value) return value || '';
    try {
      const translated = tMethods(value as any);
      return translated && translated !== value ? translated : value;
    } catch {
      return value;
    }
  };

  const translateHelpNeeded = (value: HelpNeeded | string | undefined | null): string => {
    if (!value) return value || '';
    try {
      const translated = tHelpNeeded(value as any);
      return translated && translated !== value ? translated : value;
    } catch {
      return value;
    }
  };

  return {
    translateImpactArea,
    translateStage,
    translateBeneficiary,
    translateMethod,
    translateHelpNeeded,
  };
}

