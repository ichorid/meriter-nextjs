#!/usr/bin/env node

/**
 * Translation Validator
 * 
 * Scans translation files for:
 * 1. Missing translations (key exists in one file but not the other)
 * 2. Incorrect language detection:
 *    - Russian translations that are actually English
 *    - English translations that are actually Russian
 * 3. Hardcoded user-facing strings in UI components
 */

const fs = require('fs');
const path = require('path');
const { findFiles } = require('./scan-translations-helpers');

const EN_JSON = path.join(__dirname, '../messages/en.json');
const RU_JSON = path.join(__dirname, '../messages/ru.json');
const WEB_SRC = path.join(__dirname, '../src');

// Load translation files
const enTranslations = JSON.parse(fs.readFileSync(EN_JSON, 'utf8'));
const ruTranslations = JSON.parse(fs.readFileSync(RU_JSON, 'utf8'));

/**
 * Check if text contains Cyrillic characters
 */
function containsCyrillic(text) {
    return /[А-Яа-яЁё]/.test(text);
}

/**
 * Check if text is primarily English (contains mostly Latin characters)
 */
function isPrimarilyEnglish(text) {
    if (!text || typeof text !== 'string') return false;
    const cyrillicCount = (text.match(/[А-Яа-яЁё]/g) || []).length;
    const latinCount = (text.match(/[A-Za-z]/g) || []).length;
    // If it has Cyrillic, it's not English
    if (cyrillicCount > 0) return false;
    // If it has Latin characters, it's likely English
    return latinCount > 0;
}

/**
 * Check if text is primarily Russian (contains Cyrillic characters)
 */
function isPrimarilyRussian(text) {
    if (!text || typeof text !== 'string') return false;
    return containsCyrillic(text);
}

/**
 * Flatten nested object to dot-notation keys
 */
function flattenKeys(obj, prefix = '') {
    const keys = [];
    for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            keys.push(...flattenKeys(obj[key], fullKey));
        } else {
            keys.push(fullKey);
        }
    }
    return keys;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj, key) {
    const parts = key.split('.');
    let value = obj;
    for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
            value = value[part];
        } else {
            return undefined;
        }
    }
    return value;
}

/**
 * Validate translations
 */
function validateTranslations() {
    const enKeys = flattenKeys(enTranslations);
    const ruKeys = flattenKeys(ruTranslations);
    
    const issues = {
        missingInRu: [],
        missingInEn: [],
        russianInEnglish: [], // English translation contains Russian
        englishInRussian: [], // Russian translation is actually English
        emptyTranslations: []
    };
    
    // Check all English keys
    for (const key of enKeys) {
        const enValue = getNestedValue(enTranslations, key);
        const ruValue = getNestedValue(ruTranslations, key);
        
        if (!ruValue) {
            issues.missingInRu.push(key);
        } else if (typeof enValue === 'string' && typeof ruValue === 'string') {
            // Check if Russian translation is actually English
            if (isPrimarilyEnglish(ruValue) && !isPrimarilyRussian(ruValue)) {
                // Allow paths and URLs (same in both locales)
                if (ruValue.startsWith('/') || ruValue.startsWith('http')) {
                    // skip
                } else {
                    // Allow some exceptions like "Meriter", "Email", etc.
                    const exceptions = ['Meriter', 'Email', 'URL', 'ID', 'API', 'HTTP', 'HTTPS', 'OK', 'Cancel', 'Save', 'Delete', 'Edit', 'Close', 'Open', 'Search', 'Filter', 'All', 'Settings', 'Profile', 'User', 'Admin', 'Lead', 'Participant', 'Viewer', 'Superadmin'];
                    const isException = exceptions.some(ex => ruValue === ex || ruValue.includes(ex));
                    if (!isException && ruValue.length > 2) {
                        issues.englishInRussian.push({
                            key,
                            english: enValue,
                            russian: ruValue
                        });
                    }
                }
            }
            
            // Check if English translation contains Russian
            if (isPrimarilyRussian(enValue)) {
                issues.russianInEnglish.push({
                    key,
                    english: enValue,
                    russian: ruValue
                });
            }
            
            // Check for empty translations
            if (enValue.trim() === '' || ruValue.trim() === '') {
                issues.emptyTranslations.push(key);
            }
        }
    }
    
    // Check for keys in Russian but not in English
    for (const key of ruKeys) {
        if (!enKeys.includes(key)) {
            issues.missingInEn.push(key);
        }
    }
    
    return issues;
}

/**
 * Find hardcoded user-facing strings in UI components
 */
function findHardcodedUIStrings() {
    const files = findFiles(WEB_SRC, /\.(tsx|jsx)$/).filter(file => 
        !file.includes('.test.') && 
        !file.includes('__tests__') &&
        !file.includes('node_modules') &&
        !file.includes('config/index.ts') // Skip config file
    );
    
    const issues = [];
    
    for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        // Skip if it's a test file or doesn't seem to be a component
        if (filePath.includes('.test.') || filePath.includes('__tests__') || filePath.includes('app/tests/')) {
            continue;
        }
        
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            
            // Find hardcoded strings in JSX that look user-facing
            // Pattern: text in quotes that's not a prop name, URL, or code
            const stringPattern = /['"`]([А-Яа-яЁёA-Z][А-Яа-яЁёA-Za-z\s]{3,})['"`]/g;
            let match;
            
            while ((match = stringPattern.exec(line)) !== null) {
                const text = match[1];
                const beforeMatch = line.substring(0, match.index);
                
                // Skip if it's in a comment
                if (beforeMatch.includes('//') || beforeMatch.match(/\/\*/)) {
                    continue;
                }
                
                // Skip if it's clearly code (URLs, IDs, etc.)
                if (text.includes('://') || text.includes('@') || text.match(/^[A-Z_]+$/) || text.includes('className') || text.includes('id=')) {
                    continue;
                }
                
                // Skip keyboard key names and common false positives
                const falsePositives = ['Enter', 'Escape', 'Backspace', 'Tab', 'Failed', 'Test Suite', 'Test Username', 'Maximum update depth exceeded', 'Error', 'Loading', 'Success'];
                if (falsePositives.includes(text)) {
                    continue;
                }
                
                // Skip when string is in keyboard key comparison (e.key === 'Enter' etc.)
                if (line.match(/\.key\s*===?\s*['"`]/) || line.includes("e.key ===")) {
                    continue;
                }
                
                // Skip if it's already using translation function
                if (beforeMatch.includes('useTranslations') || beforeMatch.includes('t(') || beforeMatch.includes('tCommon(') || beforeMatch.includes('tSearch(')) {
                    continue;
                }
                
                // Check if it's in JSX context (between tags or in attributes)
                const isInJSX = beforeMatch.includes('<') || beforeMatch.includes('{') || beforeMatch.includes('=');
                
                if (isInJSX && text.length > 3) {
                    // Check if it's a user-facing string (not a variable name, etc.)
                    const isUserFacing = !text.match(/^[a-z][a-zA-Z]*$/) && // Not camelCase
                                        !text.includes('_') && // Not snake_case
                                        !text.match(/^[A-Z][a-z]+[A-Z]/); // Not PascalCase
                    
                    if (isUserFacing) {
                        const relativePath = path.relative(WEB_SRC, filePath);
                        issues.push({
                            file: relativePath,
                            line: lineNum,
                            text: text,
                            fullLine: line.trim()
                        });
                    }
                }
            }
        });
    }
    
    return issues;
}

/**
 * Main execution
 */
function main() {
    console.log('🔍 Validating translations...\n');
    
    // Validate translation quality
    console.log('📊 Validating translation quality...');
    const validationIssues = validateTranslations();
    
    if (validationIssues.missingInRu.length > 0) {
        console.log(`\n❌ Missing in ru.json (${validationIssues.missingInRu.length} keys):`);
        validationIssues.missingInRu.slice(0, 10).forEach(key => {
            console.log(`   - ${key}`);
        });
        if (validationIssues.missingInRu.length > 10) {
            console.log(`   ... and ${validationIssues.missingInRu.length - 10} more`);
        }
    }
    
    if (validationIssues.missingInEn.length > 0) {
        console.log(`\n❌ Missing in en.json (${validationIssues.missingInEn.length} keys):`);
        validationIssues.missingInEn.slice(0, 10).forEach(key => {
            console.log(`   - ${key}`);
        });
        if (validationIssues.missingInEn.length > 10) {
            console.log(`   ... and ${validationIssues.missingInEn.length - 10} more`);
        }
    }
    
    if (validationIssues.englishInRussian.length > 0) {
        console.log(`\n⚠️  Russian translations that are actually English (${validationIssues.englishInRussian.length}):`);
        validationIssues.englishInRussian.slice(0, 10).forEach(issue => {
            console.log(`   - ${issue.key}`);
            console.log(`     EN: "${issue.english}"`);
            console.log(`     RU: "${issue.russian}" (should be Russian!)`);
        });
        if (validationIssues.englishInRussian.length > 10) {
            console.log(`   ... and ${validationIssues.englishInRussian.length - 10} more`);
        }
    }
    
    if (validationIssues.russianInEnglish.length > 0) {
        console.log(`\n⚠️  English translations that contain Russian (${validationIssues.russianInEnglish.length}):`);
        validationIssues.russianInEnglish.slice(0, 10).forEach(issue => {
            console.log(`   - ${issue.key}`);
            console.log(`     EN: "${issue.english}" (contains Russian!)`);
            console.log(`     RU: "${issue.russian}"`);
        });
        if (validationIssues.russianInEnglish.length > 10) {
            console.log(`   ... and ${validationIssues.russianInEnglish.length - 10} more`);
        }
    }
    
    if (validationIssues.emptyTranslations.length > 0) {
        console.log(`\n⚠️  Empty translations (${validationIssues.emptyTranslations.length}):`);
        validationIssues.emptyTranslations.slice(0, 10).forEach(key => {
            console.log(`   - ${key}`);
        });
        if (validationIssues.emptyTranslations.length > 10) {
            console.log(`   ... and ${validationIssues.emptyTranslations.length - 10} more`);
        }
    }
    
    // Find hardcoded UI strings
    console.log('\n🔎 Scanning for hardcoded user-facing strings...');
    const hardcodedStrings = findHardcodedUIStrings();
    
    console.log(`\n📝 Found ${hardcodedStrings.length} potential hardcoded user-facing strings`);
    if (hardcodedStrings.length > 0) {
        console.log('\n⚠️  Hardcoded strings (first 20):');
        hardcodedStrings.slice(0, 20).forEach(issue => {
            console.log(`   ${issue.file}:${issue.line} - "${issue.text}"`);
        });
        if (hardcodedStrings.length > 20) {
            console.log(`   ... and ${hardcodedStrings.length - 20} more`);
        }
    }
    
    // Save detailed report
    const report = {
        timestamp: new Date().toISOString(),
        validationIssues,
        hardcodedStrings
    };
    
    const reportPath = path.join(__dirname, '../translation-validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: translation-validation-report.json`);
    
    // Only block exit on translation quality issues; hardcoded strings are reported for gradual cleanup
    const totalBlockingIssues = validationIssues.missingInRu.length +
                       validationIssues.missingInEn.length +
                       validationIssues.englishInRussian.length +
                       validationIssues.russianInEnglish.length +
                       validationIssues.emptyTranslations.length;
    const totalIssues = totalBlockingIssues + hardcodedStrings.length;
    
    console.log(`\n📊 Total issues found: ${totalIssues} (${hardcodedStrings.length} hardcoded strings; ${totalBlockingIssues} blocking)`);
    
    if (totalBlockingIssues === 0) {
        console.log('\n✅ No blocking translation issues found!');
        process.exit(0);
    } else {
        console.log('\n❌ Translation issues found. Please fix them.');
        process.exit(1);
    }
}

main().catch(console.error);

