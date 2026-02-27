const fs = require('fs');
const path = require('path');

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

module.exports = { findFiles, flattenKeys, getNestedValue };

