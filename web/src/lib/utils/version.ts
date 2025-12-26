import packageJson from '../../../package.json';
import {
    FRONTEND_BUILD_SHA,
    FRONTEND_BUILD_TIME_ISO,
    FRONTEND_PACKAGE_VERSIONS,
} from '@/generated/build-info';

/**
 * Get the frontend package version from package.json
 */
export function getFrontendVersion(): string {
    return packageJson.version || 'unknown';
}

export function getFrontendBuildSha(): string {
    // Prefer generated build sha (from CI env or git), fall back to unknown.
    return FRONTEND_BUILD_SHA || 'unknown';
}

export function getFrontendBuildTimeIso(): string {
    return FRONTEND_BUILD_TIME_ISO || 'unknown';
}

export function getFrontendPackageVersions(): Readonly<Record<string, string>> {
    return FRONTEND_PACKAGE_VERSIONS;
}

