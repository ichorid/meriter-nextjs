import packageJson from '../../../package.json';

/**
 * Get the frontend package version from package.json
 */
export function getFrontendVersion(): string {
    return packageJson.version || 'unknown';
}

