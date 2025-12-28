/**
 * Taxonomy constants for volunteer project categorization
 * These define the structured metadata options for publications
 */

export const IMPACT_AREAS = [
  "Community & Mutual Aid",
  "Education & Youth",
  "Health & Wellbeing",
  "Environment & Climate",
  "Animals & Nature Protection",
  "Inclusion & Accessibility",
  "Humanitarian Aid & Crisis Response",
  "Civic Engagement & Democracy",
  "Culture, Arts & Heritage",
  "Economic Empowerment",
  "Public Space & Local Infrastructure",
  "Research, Advocacy & Awareness",
] as const;

export const BENEFICIARIES = [
  "Children & teens",
  "Elderly",
  "People with disabilities",
  "Low-income families",
  "Migrants & refugees",
  "Patients & caregivers",
  "Local community (general)",
  "Animals / wildlife",
  "Everyone (public-interest)",
] as const;

export const METHODS = [
  "Direct service",
  "Events & community building",
  "Education & training",
  "Building / restoration",
  "Donations & distribution",
  "Tech / tools / platforms",
  "Research & data",
  "Advocacy & campaigning",
  "Emergency response",
] as const;

export const STAGES = [
  "Idea / looking for team",
  "Active / ongoing",
  "Needs volunteers now",
  "Fundraising / collecting resources",
  "Completed (showcase results)",
] as const;

export const HELP_NEEDED = [
  "Volunteers (time)",
  "Money",
  "Materials / equipment",
  "Expertise",
  "Partnerships",
  "Venue / space",
  "Visibility / PR",
  "Logistics / transport",
] as const;

// TypeScript types
export type ImpactArea = (typeof IMPACT_AREAS)[number];
export type Beneficiary = (typeof BENEFICIARIES)[number];
export type Method = (typeof METHODS)[number];
export type Stage = (typeof STAGES)[number];
export type HelpNeeded = (typeof HELP_NEEDED)[number];




