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

module.exports = { findFiles };

