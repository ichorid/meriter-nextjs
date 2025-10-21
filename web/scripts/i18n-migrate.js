#!/usr/bin/env node

/**
 * I18N Migration Script
 * Automatically updates components to use react-i18next translations
 */

const fs = require('fs');
const path = require('path');

// Mapping of files to their translation namespace
const fileToNamespace = {
    // Comments
    'features/comments/components/form-comment-vote.tsx': 'comments',
    'features/comments/components/form-comment.tsx': 'comments',
    'features/comments/components/comment.tsx': 'comments',
    'features/comments/hooks/use-comments.ts': 'comments',
    
    // Feed
    'features/feed/components/components.tsx': 'feed',
    'features/feed/components/publication.tsx': 'feed',
    
    // Wallet
    'features/wallet/components/form-withdraw.tsx': 'shared',
    'features/wallet/components/bar-withdraw.tsx': 'shared',
    'features/wallet/components/widget-avatar-balance.tsx': 'shared',
    'features/wallet/components/transaction-to-me.tsx': 'shared',
    
    // Communities
    'features/communities/components/form-dimensions-editor.tsx': 'communities',
    
    // Shared
    'shared/components/menu-breadcrumbs.tsx': 'shared',
    'shared/components/logout-button.tsx': 'shared',
};

// Translation key mappings (Russian -> English key)
const translations = {
    // Comments
    'Плюсануть на': 'upvoteQuota',
    'суточной квоты': 'upvoteQuota',
    'Плюсануть на': 'upvoteBalance',
    'с Баланса': 'upvoteBalance',
    'Слайдер вправо - плюсануть': 'sliderUpvote',
    'Слайдер влево - минусануть': 'sliderDownvote',
    'Минусануть на': 'downvoteQuota',
    'Двигайте слайдер, чтобы выбрать количество баллов': 'sliderHint',
    'Расскажите, почему вы поставили такую оценку. Нам ценно ваше мнение': 'commentHint',
    'закрыть[x]': 'close',
    'Минусовое голосование возможно только с Баланса. ': 'downvoteRequiresBalance',
    'Cнимите баллы с публикаций на свой Баланс': 'withdrawToBalance',
    'Недостаточно баллов. ': 'insufficientPoints',
    'Добавьте их на свой Баланс': 'addToBalance',
    'Введите комментарий!': 'enterComment',
    'Добавить': 'add',
    'Снять': 'remove',
    'меритов': 'merits',
    'баллов сообщества': 'communityPoints',
    'Мериты': 'merits',
    'Баллы': 'points',
    
    // Feed
    'Сохраняю...': 'saving',
    'Сохранено!': 'saved',
    '← Назад': 'back',
    '+ Добавить публикацию': 'addPublication',
    'для': 'forBeneficiary',
    
    // Wallet
    'Напишите комментарий': 'writeComment',
    'Снять: ': 'withdraw',
    'Баланс: ': 'balance',
    'от ': 'from',
    'В ответ на: ': 'inReplyTo',
    'эту запись': 'thisPost',
    
    // Communities
    'Другое': 'other',
    
    // Shared
    'Выйти': 'logout',
};

function addUseTranslationImport(content, namespace) {
    // Check if already imported
    if (content.includes("useTranslation")) {
        return content;
    }
    
    // Add import after other imports
    const importRegex = /^(import.*from.*;\n)+/m;
    const match = content.match(importRegex);
    
    if (match) {
        const lastImport = match[0];
        return content.replace(
            lastImport,
            lastImport + "import { useTranslation } from 'react-i18next';\n"
        );
    }
    
    return content;
}

function addUseTranslationHook(content, namespace) {
    // Check if already added
    if (content.includes("useTranslation(")) {
        return content;
    }
    
    // Find component function
    const componentRegex = /(export (?:const|function) \w+.*?(?:=>|{).*?\n)/s;
    const match = content.match(componentRegex);
    
    if (match) {
        const afterDeclaration = match[0];
        const hookLine = `    const { t } = useTranslation('${namespace}');\n`;
        
        // Insert after function declaration, before first useState or other hooks
        return content.replace(
            afterDeclaration,
            afterDeclaration + hookLine
        );
    }
    
    return content;
}

function migrateFile(filePath, namespace) {
    console.log(`\n📝 Migrating: ${filePath}`);
    
    const fullPath = path.join(__dirname, '..', 'src', filePath);
    
    if (!fs.existsSync(fullPath)) {
        console.log(`  ⚠️  File not found, skipping`);
        return;
    }
    
    let content = fs.readFileSync(fullPath, 'utf8');
    const originalContent = content;
    
    // Step 1: Add import
    content = addUseTranslationImport(content, namespace);
    
    // Step 2: Add hook
    content = addUseTranslationHook(content, namespace);
    
    // Step 3: Count Russian strings
    const cyrillicRegex = /[А-Яа-яЁё]/g;
    const matches = content.match(cyrillicRegex);
    const count = matches ? matches.length : 0;
    
    if (content !== originalContent) {
        // Create backup
        const backupPath = fullPath + '.backup';
        fs.writeFileSync(backupPath, originalContent);
        
        // Write updated content
        fs.writeFileSync(fullPath, content);
        console.log(`  ✅ Updated (added imports and hooks)`);
        console.log(`  📊 Remaining Russian characters: ${count}`);
        console.log(`  💾 Backup saved: ${backupPath}`);
    } else {
        console.log(`  ℹ️  No changes needed`);
    }
}

function main() {
    console.log('🚀 Starting I18N Migration\n');
    console.log('This script will:');
    console.log('  1. Add useTranslation imports');
    console.log('  2. Add useTranslation hooks');
    console.log('  3. Report remaining Russian strings\n');
    console.log('Note: Russian string replacement must be done manually or with additional scripts\n');
    console.log('=' .repeat(60));
    
    Object.entries(fileToNamespace).forEach(([file, namespace]) => {
        migrateFile(file, namespace);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('\n✨ Migration preparation complete!');
    console.log('\nNext steps:');
    console.log('  1. Review the changes');
    console.log('  2. Manually replace Russian strings with t() calls');
    console.log('  3. Test each component');
    console.log('  4. Remove .backup files when satisfied\n');
}

main();

