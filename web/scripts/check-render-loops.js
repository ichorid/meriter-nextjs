#!/usr/bin/env node

/**
 * Static analysis script to detect potential infinite re-render loops
 * Checks for common patterns that cause infinite loops:
 * 1. useMemo/useCallback with unstable dependencies
 * 2. Functions called in render that create new objects/arrays
 * 3. Missing memoization for expensive computations
 * 4. State updates in render (outside useEffect)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SRC_DIR = path.join(__dirname, '../src');
const MAX_FILE_SIZE = 500 * 1024; // 500KB

// Patterns that indicate potential issues
// Only check .tsx files (not .ts or test files) for render-related issues
const PATTERNS = [
    {
        name: 'Function call in render creating new object',
        pattern: /(getAuthEnv|getEnabledProviders)\s*\(/,
        context: /(return\s+|<[A-Z]|const\s+\w+\s*=\s*(?!useMemo|useCallback|useEffect))/,
        severity: 'warning',
        message: 'Function call in render may create new object/array references on each render - consider useMemo',
        excludeFiles: /\.(test|spec)\.(tsx?|jsx?)$/,
    },
    {
        name: 'useMemo with function call dependency',
        pattern: /useMemo\([^,]+,\s*\[[^\]]*(getAuthEnv|getEnabledProviders)\s*\([^)]*\)[^\]]*\]\)/,
        severity: 'error',
        message: 'useMemo dependency includes function call - should be memoized or moved outside',
        excludeFiles: /\.(test|spec)\.(tsx?|jsx?)$/,
    },
    {
        name: 'Array/object literal in render',
        pattern: /(const\s+\w+\s*=\s*\[[^\]]*\]|const\s+\w+\s*=\s*\{[^}]*\})\s*(?!.*useMemo|.*useCallback|.*useEffect)/,
        context: /(return\s+|<[A-Z]|^[^/]*const)/,
        severity: 'warning',
        message: 'Array/object literal in render creates new reference each time - consider useMemo',
        excludeFiles: /\.(test|spec)\.(tsx?|jsx?)$/,
    },
];

function findFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    files.forEach((file) => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.next')) {
            findFiles(filePath, fileList);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            if (stat.size < MAX_FILE_SIZE) {
                fileList.push(filePath);
            }
        }
    });

    return fileList;
}

function checkFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const issues = [];

    // Skip test files and non-component files
    if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('__tests__')) {
        return issues;
    }

    // Only check .tsx files (React components)
    if (!filePath.endsWith('.tsx')) {
        return issues;
    }

    PATTERNS.forEach(({ name, pattern, context, severity, message, excludeFiles }) => {
        // Skip if file matches exclude pattern
        if (excludeFiles && excludeFiles.test(filePath)) {
            return;
        }

        const matches = content.matchAll(new RegExp(pattern, 'g'));
        
        for (const match of matches) {
            const matchIndex = match.index;
            const lineNumber = content.substring(0, matchIndex).split('\n').length;
            const line = lines[lineNumber - 1];

            // Skip if inside a comment
            const beforeLine = content.substring(0, matchIndex);
            const lastComment = beforeLine.lastIndexOf('//');
            const lastNewline = beforeLine.lastIndexOf('\n');
            if (lastComment > lastNewline) {
                continue; // Inside a comment
            }

            // Get context before match
            const beforeMatch = content.substring(Math.max(0, matchIndex - 200), matchIndex);

            // If context is specified, check if pattern appears in that context
            if (context) {
                if (!context.test(beforeMatch + match[0])) {
                    continue;
                }
            }

            // Skip if inside a function that's not a component (e.g., helper function)
            const functionContext = beforeMatch.match(/(function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\(|export\s+(?:default\s+)?function)/);
            if (functionContext && !functionContext[0].includes('Component') && !functionContext[0].includes('export')) {
                // Check if it's likely a component (starts with uppercase or is default export)
                const isComponent = /^(export\s+default\s+function|function\s+[A-Z]|export\s+function\s+[A-Z])/.test(functionContext[0]);
                if (!isComponent) {
                    continue;
                }
            }

            issues.push({
                file: path.relative(SRC_DIR, filePath),
                line: lineNumber,
                severity,
                message: `${name}: ${message}`,
                code: line.trim(),
            });
        }
    });

    return issues;
}

function main() {
    console.log('🔍 Checking for potential infinite re-render loops...\n');

    const files = findFiles(SRC_DIR);
    const allIssues = [];

    files.forEach((file) => {
        const issues = checkFile(file);
        allIssues.push(...issues);
    });

    if (allIssues.length === 0) {
        console.log('✅ No potential render loop issues detected!\n');
        process.exit(0);
    }

    // Group by severity
    const errors = allIssues.filter((i) => i.severity === 'error');
    const warnings = allIssues.filter((i) => i.severity === 'warning');

    console.log(`Found ${allIssues.length} potential issues:\n`);
    console.log(`  ❌ ${errors.length} errors`);
    console.log(`  ⚠️  ${warnings.length} warnings\n`);

    // Print errors first
    if (errors.length > 0) {
        console.log('❌ ERRORS:\n');
        errors.forEach((issue) => {
            console.log(`  ${issue.file}:${issue.line}`);
            console.log(`    ${issue.message}`);
            console.log(`    ${issue.code}\n`);
        });
    }

    // Then warnings
    if (warnings.length > 0) {
        console.log('⚠️  WARNINGS:\n');
        warnings.forEach((issue) => {
            console.log(`  ${issue.file}:${issue.line}`);
            console.log(`    ${issue.message}`);
            console.log(`    ${issue.code}\n`);
        });
    }

    // Exit with error code if there are critical issues
    if (errors.length > 0) {
        console.log('💡 Tip: Use useMemo/useCallback to stabilize object/array references\n');
        process.exit(1);
    }

    process.exit(0);
}

if (require.main === module) {
    main();
}

module.exports = { checkFile, findFiles };

