#!/usr/bin/env tsx
/**
 * React Query Hooks Generator
 * 
 * Generates high-level React Query hooks with business logic from Orval-generated hooks
 * and hook configurations.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  communitiesHookConfig,
  pollsHookConfig,
  commentsHookConfig,
  publicationsHookConfig,
  type HookConfig,
} from '../src/lib/api/hook-configs';
import {
  generateListHook,
  generateInfiniteHook,
  generateDetailHook,
  generateCreateHook,
  generateUpdateHook,
  generateDeleteHook,
  generateCustomHook,
  generateCustomHookWithOptimistic,
} from './hook-templates';

const GENERATED_DIR = path.join(__dirname, '../src/lib/api/hooks');
const HOOKS_API_DIR = path.join(__dirname, '../src/hooks/api');

// Ensure output directory exists
if (!fs.existsSync(GENERATED_DIR)) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

/**
 * Generate hooks for a resource
 */
function generateResourceHooks(config: HookConfig): string {
  const resourceName = config.resourceName;
  const capitalized = capitalize(resourceName);
  
  const imports = generateImports(config);
  const hooks: string[] = [];

  // Generate standard CRUD hooks
  if (config.endpoints.list) {
    hooks.push(generateListHook(config, resourceName).code);
    hooks.push(generateInfiniteHook(config, resourceName).code);
  }

  if (config.endpoints.detail) {
    hooks.push(generateDetailHook(config, resourceName).code);
  }

  if (config.endpoints.create) {
    hooks.push(generateCreateHook(config, resourceName).code);
  }

  if (config.endpoints.update) {
    hooks.push(generateUpdateHook(config, resourceName).code);
  }

  if (config.endpoints.delete) {
    hooks.push(generateDeleteHook(config, resourceName).code);
  }

  // Generate custom hooks
  Object.entries(config.endpoints).forEach(([operationName, endpoint]) => {
    if (endpoint.custom && !['list', 'detail', 'create', 'update', 'delete'].includes(operationName)) {
      // Check if should skip
      if (config.customHooks?.[operationName]?.skip) {
        return;
      }

      // Determine hook name - for cast it's useCastPoll, for results it's usePollResults
      let fullHookName: string;
      const singularName = resourceName.endsWith('s') ? resourceName.slice(0, -1) : resourceName;
      const fixedSingular = singularName === 'communitie' ? 'community' : singularName;
      const singularCapitalized = capitalize(fixedSingular);
      
      if (operationName === 'cast') {
        fullHookName = `useCast${singularCapitalized}`;
      } else if (operationName === 'results') {
        fullHookName = `use${singularCapitalized}Results`;
      } else {
        fullHookName = `use${capitalize(operationName)}${singularCapitalized}`;
      }

      // Check for optimistic updates
      if (config.optimisticUpdates?.[operationName]) {
        hooks.push(generateCustomHookWithOptimistic(config, resourceName, fullHookName, endpoint, operationName).code);
      } else {
        hooks.push(generateCustomHook(config, resourceName, fullHookName, endpoint, operationName).code);
      }
    }
  });

  const header = `/**
 * Generated React Query hooks for ${capitalized}
 * 
 * This file is auto-generated. Do not edit manually.
 * Generated at: ${new Date().toISOString()}
 * 
 * To regenerate: pnpm generate:hooks
 */

${imports}

`;

  return header + hooks.join('\n\n');
}

/**
 * Generate imports for a resource
 */
function generateImports(config: HookConfig): string {
  const resourceName = config.resourceName;
  // Use singular form for types: communities -> Community
  let singularName = resourceName.endsWith('s') ? resourceName.slice(0, -1) : resourceName;
  // Fix: communitie -> community
  if (singularName === 'communitie') {
    singularName = 'community';
  }
  const typeName = capitalize(singularName);
  
  const imports: string[] = [
    `import {`,
    `    useQuery,`,
    `    useMutation,`,
    `    useQueryClient,`,
    `    useInfiniteQuery,`,
    `} from "@tanstack/react-query";`,
    `import { ${config.apiWrapper} } from "@/lib/api/wrappers/${resourceName}-api";`,
    `import { queryKeys } from "@/lib/constants/queryKeys";`,
    `import { serializeQueryParams } from "@/lib/utils/queryKeys";`,
    `import type { PaginatedResponse, ${typeName}, Create${typeName}Dto } from "@/types/api-v1";`,
  ];

  // Add validation imports if needed
  if (config.validation) {
    imports.push(`import {`);
    imports.push(`    useValidatedQuery,`);
    imports.push(`    useValidatedMutation,`);
    imports.push(`} from "@/lib/api/validated-query";`);
    imports.push(`import { ${typeName}Schema, Create${typeName}DtoSchema } from "@/types/api-v1/schemas";`);
  }

  // Add optimistic update imports if needed
  if (config.optimisticUpdates && Object.keys(config.optimisticUpdates).length > 0) {
    imports.push(`import { useAuth } from "@/contexts/AuthContext";`);
    imports.push(`import {`);
    imports.push(`    updateWalletOptimistically,`);
    imports.push(`    rollbackOptimisticUpdates,`);
    imports.push(`    type OptimisticUpdateContext,`);
    imports.push(`} from "@/hooks/api/useVotes.helpers";`);
  }

  return imports.join('\n');
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format generated code with Prettier (if available)
 */
async function formatCode(code: string): Promise<string> {
  try {
    // Try to use prettier if available
    const prettier = await import('prettier');
    const config = await prettier.resolveConfig(__dirname);
    return await prettier.format(code, {
      ...config,
      parser: 'typescript',
    });
  } catch {
    // If prettier is not available, return as-is
    return code;
  }
}

/**
 * Main generation function
 */
async function main() {
  console.log('🚀 Generating React Query hooks...\n');

  const configs: [string, HookConfig][] = [
    ['communities', communitiesHookConfig],
    ['polls', pollsHookConfig],
    ['comments', commentsHookConfig],
    ['publications', publicationsHookConfig],
  ];

  for (const [resourceName, config] of configs) {
    console.log(`📝 Generating hooks for ${resourceName}...`);
    
    try {
      const generatedCode = generateResourceHooks(config);
      const formattedCode = await formatCode(generatedCode);
      
      // Use plural form for filename: communities -> useCommunities.generated.ts
      const resourceNameCapitalized = capitalize(resourceName);
      const outputPath = path.join(GENERATED_DIR, `use${resourceNameCapitalized}.generated.ts`);
      fs.writeFileSync(outputPath, formattedCode, 'utf-8');
      
      console.log(`   ✓ Generated ${outputPath}`);
    } catch (error) {
      console.error(`   ✗ Error generating hooks for ${resourceName}:`, error);
      process.exit(1);
    }
  }

  console.log('\n✅ Hook generation complete!');
  console.log(`\nGenerated files are in: ${GENERATED_DIR}`);
  console.log('\nNext steps:');
  console.log('1. Review generated hooks');
  console.log('2. Update existing hook files to import from generated hooks');
  console.log('3. Test hooks in your application');
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { generateResourceHooks, generateImports };

