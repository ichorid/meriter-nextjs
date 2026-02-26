#!/usr/bin/env node

/**
 * Translation Scanner
 * 
 * Scans the codebase for:
 * 1. Missing translation keys between en.json and ru.json
 * 2. Hardcoded English/Russian strings in components
 * 3. Fallback strings (|| 'text' patterns)
 * 4. Direct strings in JSX
 */

const fs = require('fs');
const path = require('path');

const WEB_SRC = path.join(__dirname, '../src');
const EN_JSON = path.join(__dirname, '../messages/en.json');
const RU_JSON = path.join(__dirname, '../messages/ru.json');

/**
 * Recursively find all files matching pattern
 */
function findFiles(dir, pattern, fileList = []) {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            // Skip node_modules and other ignored directories
            if (!file.startsWith('.') && file !== 'node_modules') {
                findFiles(filePath, pattern, fileList);
            }
        } else if (pattern.test(file)) {
            fileList.push(filePath);
        }
    });
    
    return fileList;
}

// Load translation files
const enTranslations = JSON.parse(fs.readFileSync(EN_JSON, 'utf8'));
const ruTranslations = JSON.parse(fs.readFileSync(RU_JSON, 'utf8'));

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
 * Compare translation files
 */
function compareTranslations() {
    const enKeys = flattenKeys(enTranslations);
    const ruKeys = flattenKeys(ruTranslations);
    
    const missingInRu = enKeys.filter(key => !ruKeys.includes(key));
    const missingInEn = ruKeys.filter(key => !enKeys.includes(key));
    
    return { missingInRu, missingInEn };
}

/**
 * Find hardcoded strings in TypeScript/TSX files
 */
function findHardcodedStrings() {
    const files = findFiles(WEB_SRC, /\.(ts|tsx)$/).filter(file => 
        !file.includes('.test.') && 
        !file.includes('__tests__') &&
        !file.includes('node_modules')
    );
    
    const issues = {
        fallbackStrings: [], // t('key') || 'text'
        directStrings: [], // {'Text'} or "Text" in JSX
        ariaLabels: [], // aria-label="Text"
        placeholders: [], // placeholder="Text"
        russianText: [], // Cyrillic characters
        configStrings: [] // Strings in config files
    };
    
    for (const file of files) {
        const filePath = file; // file is already a full path from findFiles
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        // Skip test files and node_modules
        if (file.includes('.test.') || file.includes('__tests__')) {
            continue;
        }
        
        lines.forEach((line, index) => {
            const lineNum = index + 1;
            
            // Find fallback strings: t('key') || 'text' or t("key") || "text"
            const fallbackPattern = /t\(['"]([^'"]+)['"]\)\s*\|\|\s*['"]([^'"]+)['"]/g;
            let match;
            while ((match = fallbackPattern.exec(line)) !== null) {
                const relativePath = path.relative(WEB_SRC, filePath);
                issues.fallbackStrings.push({
                    file: relativePath,
                    line: lineNum,
                    translationKey: match[1],
                    fallbackText: match[2],
                    fullLine: line.trim()
                });
            }
            
            // Find direct strings in JSX (but skip comments and strings that look like code)
            // Pattern: {'Text'} or "Text" or 'Text' in JSX context
            const directStringPattern = /['"]([А-Яа-яЁёA-Z][А-Яа-яЁёA-Za-z\s]{2,})['"]/g;
            let directMatch;
            while ((directMatch = directStringPattern.exec(line)) !== null) {
                const text = directMatch[1];
                // Skip if it's clearly code (URLs, IDs, etc.)
                if (text.includes('://') || text.includes('@') || text.match(/^[A-Z_]+$/)) {
                    continue;
                }
                // Check if it's in JSX context (not in a string literal or comment)
                const beforeMatch = line.substring(0, directMatch.index);
                const afterMatch = line.substring(directMatch.index);
                
                // Skip if it's in a comment
                if (beforeMatch.includes('//') || beforeMatch.match(/\/\*/)) {
                    continue;
                }
                
                // Check if it's Cyrillic (Russian)
                if (/[А-Яа-яЁё]/.test(text)) {
                    const relativePath = path.relative(WEB_SRC, filePath);
                    // Skip emoji metadata in getIcon.ts (keywords/names not user-visible in UI)
                    if (relativePath.includes('getIcon.ts')) continue;
                    issues.russianText.push({
                        file: relativePath,
                        line: lineNum,
                        text,
                        fullLine: line.trim()
                    });
                } else if (text.length > 3 && !text.match(/^(User|Unknown|Create|Select|Expires|Invite|Generate|Copied|Please|No members|Community|Type|Active|Used|Expired)$/i)) {
                    // Only flag if it's a meaningful English string (not common code words)
                    // This is a heuristic - we'll refine it
                }
            }
            
            // Find aria-label="Text"
            const ariaPattern = /aria-label\s*=\s*['"]([^'"]+)['"]/g;
            let ariaMatch;
            while ((ariaMatch = ariaPattern.exec(line)) !== null) {
                const label = ariaMatch[1];
                if (label.length > 2 && !label.match(/^[a-z-]+$/)) { // Not just CSS classes
                    const relativePath = path.relative(WEB_SRC, filePath);
                    issues.ariaLabels.push({
                        file: relativePath,
                        line: lineNum,
                        label,
                        fullLine: line.trim()
                    });
                }
            }
            
            // Find placeholder="Text"
            const placeholderPattern = /placeholder\s*=\s*['"]([^'"]+)['"]/g;
            let placeholderMatch;
            while ((placeholderMatch = placeholderPattern.exec(line)) !== null) {
                const placeholder = placeholderMatch[1];
                if (placeholder.length > 2) {
                    const relativePath = path.relative(WEB_SRC, filePath);
                    issues.placeholders.push({
                        file: relativePath,
                        line: lineNum,
                        placeholder,
                        fullLine: line.trim()
                    });
                }
            }
            
            // Skip comments for the following checks
            const lineTrimmed = line.trim();
            if (lineTrimmed.startsWith('//') || lineTrimmed.startsWith('*') || lineTrimmed.startsWith('/*')) {
                return;
            }
            const relativePathForRussian = path.relative(WEB_SRC, filePath);
            if (relativePathForRussian.includes('getIcon.ts')) return;
            
            // 1. Template literals (backticks) containing Cyrillic
            const templateLiteralPattern = /`([^`]*[А-Яа-яЁё][^`]*)`/g;
            let tplMatch;
            while ((tplMatch = templateLiteralPattern.exec(line)) !== null) {
                const text = tplMatch[1].trim();
                if (text.length > 0) {
                    issues.russianText.push({
                        file: relativePathForRussian,
                        line: lineNum,
                        text: text.length > 60 ? text.slice(0, 60) + '…' : text,
                        fullLine: line.trim()
                    });
                }
            }
            
            // 2. JSX text content: text between > and < or { that contains Cyrillic
            const jsxTextPattern = />([^<{}]*[А-Яа-яЁё][^<{}]*)(?=<|\{|$)/g;
            let jsxMatch;
            while ((jsxMatch = jsxTextPattern.exec(line)) !== null) {
                const text = jsxMatch[1].trim();
                const firstCyrillicInMatch = jsxMatch[1].search(/[А-Яа-яЁё]/);
                const cyrillicPos = firstCyrillicInMatch >= 0 ? jsxMatch.index + 1 + firstCyrillicInMatch : jsxMatch.index + 1;
                if (text.length > 0 && !isCyrillicOnlyInRegex(line, cyrillicPos)) {
                    issues.russianText.push({
                        file: relativePathForRussian,
                        line: lineNum,
                        text,
                        fullLine: line.trim()
                    });
                }
            }
            
            // 3. Unquoted Cyrillic after } (e.g. "} меритов")
            const afterExprPattern = /}\s*([А-Яа-яЁё][А-Яа-яЁёa-zA-Z\s]*?)(?=<|}|$)/g;
            let afterMatch;
            while ((afterMatch = afterExprPattern.exec(line)) !== null) {
                const text = afterMatch[1].trim();
                const cyrillicStart = afterMatch.index + afterMatch[0].indexOf(afterMatch[1]);
                if (text.length > 0 && !isCyrillicOnlyInRegex(line, cyrillicStart)) {
                    issues.russianText.push({
                        file: relativePathForRussian,
                        line: lineNum,
                        text,
                        fullLine: line.trim()
                    });
                }
            }
            
            // 4. Line-starting Cyrillic (e.g. "            Прогресс: {x}")
            const lineStartCyrillicPattern = /^\s*([А-Яа-яЁё][А-Яа-яЁё\s:,\-!?./]*?)(?=\s*[\{<]|\s*$)/;
            const lineStartMatch = line.match(lineStartCyrillicPattern);
            if (lineStartMatch) {
                const text = lineStartMatch[1].trim();
                const pos = line.indexOf(lineStartMatch[1]);
                if (text.length > 0 && pos >= 0 && !isCyrillicOnlyInRegex(line, pos)) {
                    issues.russianText.push({
                        file: relativePathForRussian,
                        line: lineNum,
                        text,
                        fullLine: line.trim()
                    });
                }
            }
        });
    }
    
    return issues;
}

/**
 * Avoid flagging Cyrillic inside regex literals (e.g. /^[a-zа-яё0-9_]+$/)
 */
function isCyrillicOnlyInRegex(line, cyrillicIndex) {
    // Exclude < and > so we don't treat "/60">Баланс:</span>" as one regex
    const regexLiteralPattern = /\/(?![*\/])(?:[^/\\<>]|\\.)*\/[gimsuy]*/g;
    let reMatch;
    while ((reMatch = regexLiteralPattern.exec(line)) !== null) {
        if (cyrillicIndex >= reMatch.index && cyrillicIndex < reMatch.index + reMatch[0].length) {
            return true;
        }
    }
    return false;
}

/**
 * Find strings in config files
 */
function findConfigStrings() {
    const configFile = path.join(WEB_SRC, '../config/index.ts');
    if (!fs.existsSync(configFile)) {
        return [];
    }
    
    const content = fs.readFileSync(configFile, 'utf8');
    const lines = content.split('\n');
    const issues = [];
    
    lines.forEach((line, index) => {
        // Find Russian text in config
        if (/[А-Яа-яЁё]/.test(line)) {
            issues.push({
                file: 'config/index.ts',
                line: index + 1,
                text: line.match(/[А-Яа-яЁё][^'"]*/)?.[0] || '',
                fullLine: line.trim()
            });
        }
    });
    
    return issues;
}

/**
 * Main execution
 */
async function main() {
    console.log('🔍 Scanning for translation issues...\n');
    
    // Compare translation files
    console.log('📊 Comparing translation files...');
    const { missingInRu, missingInEn } = compareTranslations();
    
    if (missingInRu.length > 0) {
        console.log(`\n❌ Missing in ru.json (${missingInRu.length} keys):`);
        missingInRu.slice(0, 20).forEach(key => {
            console.log(`   - ${key}`);
        });
        if (missingInRu.length > 20) {
            console.log(`   ... and ${missingInRu.length - 20} more`);
        }
    }
    
    if (missingInEn.length > 0) {
        console.log(`\n❌ Missing in en.json (${missingInEn.length} keys):`);
        missingInEn.slice(0, 20).forEach(key => {
            console.log(`   - ${key}`);
        });
        if (missingInEn.length > 20) {
            console.log(`   ... and ${missingInEn.length - 20} more`);
        }
    }
    
    if (missingInRu.length === 0 && missingInEn.length === 0) {
        console.log('✅ Translation keys are in sync!');
    }
    
    // Find hardcoded strings
    console.log('\n🔎 Scanning for hardcoded strings...');
    const hardcodedIssues = findHardcodedStrings();
    const configIssues = findConfigStrings();
    
    // Fix NaN issue
    const russianCount = (hardcodedIssues.russianText?.length || 0) + (configIssues?.length || 0);
    
    console.log(`\n📝 Found issues:`);
    console.log(`   - Fallback strings: ${hardcodedIssues.fallbackStrings.length}`);
    console.log(`   - Russian text: ${russianCount}`);
    console.log(`   - Aria labels: ${hardcodedIssues.ariaLabels.length}`);
    console.log(`   - Placeholders: ${hardcodedIssues.placeholders.length}`);
    
    // Show some examples
    if (hardcodedIssues.fallbackStrings.length > 0) {
        console.log(`\n⚠️  Fallback strings (first 10):`);
        hardcodedIssues.fallbackStrings.slice(0, 10).forEach(issue => {
            console.log(`   ${issue.file}:${issue.line} - "${issue.fallbackText}" (key: ${issue.translationKey})`);
        });
    }
    
    const allRussianText = [...(hardcodedIssues.russianText || []), ...(configIssues || [])];
    if (allRussianText.length > 0) {
        console.log(`\n⚠️  Russian text found (first 10):`);
        allRussianText.slice(0, 10).forEach(issue => {
            console.log(`   ${issue.file}:${issue.line} - "${issue.text}"`);
        });
    }
    
    if (hardcodedIssues.ariaLabels.length > 0) {
        console.log(`\n⚠️  Hardcoded aria-labels (first 10):`);
        hardcodedIssues.ariaLabels.slice(0, 10).forEach(issue => {
            console.log(`   ${issue.file}:${issue.line} - "${issue.label}"`);
        });
    }
    
    // Save detailed report
    const report = {
        timestamp: new Date().toISOString(),
        missingKeys: {
            inRu: missingInRu,
            inEn: missingInEn
        },
        hardcodedStrings: hardcodedIssues,
        configStrings: configIssues
    };
    
    const reportPath = path.join(__dirname, '../translation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved to: translation-report.json`);
    
    const totalIssues = missingInRu.length + missingInEn.length + 
                       hardcodedIssues.fallbackStrings.length + 
                       russianCount +
                       hardcodedIssues.ariaLabels.length;
    
    console.log(`\n📊 Total issues found: ${totalIssues}`);
    
    if (totalIssues === 0) {
        console.log('\n✅ No translation issues found!');
        process.exit(0);
    } else {
        console.log('\n❌ Translation issues found. Please fix them.');
        process.exit(1);
    }
}

main().catch(console.error);

