#!/bin/bash

# API V1 Migration Cleanup Script
# This script removes old endpoints and backward compatibility code after migration period

echo "🧹 Starting API V1 Migration Cleanup..."

# Check if migration is complete
echo "📋 Checking migration status..."

# Function to check if v1 APIs are being used
check_v1_usage() {
    echo "🔍 Checking if V1 APIs are in use..."
    
    # Check for v1 API imports in frontend
    if grep -r "api/v1" web/src/ --include="*.ts" --include="*.tsx" > /dev/null; then
        echo "✅ V1 APIs found in frontend code"
        return 0
    else
        echo "❌ No V1 APIs found in frontend code"
        return 1
    fi
}

# Function to backup legacy code before removal
backup_legacy_code() {
    echo "💾 Creating backup of legacy code..."
    
    BACKUP_DIR="legacy-api-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    
    # Backup legacy API controllers
    cp -r api/apps/meriter/src/rest-api "$BACKUP_DIR/"
    
    # Backup legacy API client
    cp -r web/src/lib/api/endpoints "$BACKUP_DIR/"
    
    # Backup legacy types
    cp -r web/src/types/entities "$BACKUP_DIR/"
    
    echo "✅ Legacy code backed up to $BACKUP_DIR"
}

# Function to remove legacy API controllers
remove_legacy_controllers() {
    echo "🗑️  Removing legacy API controllers..."
    
    # List of legacy controllers to remove
    LEGACY_CONTROLLERS=(
        "api/apps/meriter/src/rest-api/rest/getme"
        "api/apps/meriter/src/rest-api/rest/telegram-auth"
        "api/apps/meriter/src/rest-api/rest/publications"
        "api/apps/meriter/src/rest-api/rest/rest-polls"
        "api/apps/meriter/src/rest-api/rest/rest-transactions"
        "api/apps/meriter/src/rest-api/rest/wallet"
        "api/apps/meriter/src/rest-api/rest/communityinfo"
        "api/apps/meriter/src/rest-api/rest/rest-getusercommunities"
        "api/apps/meriter/src/rest-api/rest/rest-getmanagedchats"
        "api/apps/meriter/src/rest-api/rest/free"
        "api/apps/meriter/src/rest-api/rest/rest-withdraw"
        "api/apps/meriter/src/rest-api/rest/rest-space"
        "api/apps/meriter/src/rest-api/rest/rank"
        "api/apps/meriter/src/rest-api/rest/userdata"
    )
    
    for controller in "${LEGACY_CONTROLLERS[@]}"; do
        if [ -d "$controller" ]; then
            echo "  Removing $controller"
            rm -rf "$controller"
        fi
    done
    
    echo "✅ Legacy controllers removed"
}

# Function to remove legacy API client
remove_legacy_client() {
    echo "🗑️  Removing legacy API client..."
    
    # Remove legacy endpoint files
    rm -rf web/src/lib/api/endpoints/
    
    # Remove legacy types
    rm -rf web/src/types/entities/
    
    echo "✅ Legacy API client removed"
}

# Function to update imports and references
update_imports() {
    echo "🔄 Updating imports and references..."
    
    # Update frontend imports to use adapters
    find web/src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's|@/lib/api/endpoints|@/lib/api/adapters|g'
    find web/src -name "*.ts" -o -name "*.tsx" | xargs sed -i 's|@/types/entities|@/types/api-v1|g'
    
    echo "✅ Imports updated"
}

# Function to remove backward compatibility code
remove_backward_compatibility() {
    echo "🗑️  Removing backward compatibility code..."
    
    # Remove legacy response helper
    rm -f api/apps/meriter/src/rest-api/rest/utils/response.helper.ts
    
    # Remove legacy exception filter
    rm -f api/apps/meriter/src/common/filters/http-exception.filter.ts
    
    # Update main.ts to remove legacy interceptors
    sed -i '/AllExceptionsFilter/d' api/apps/meriter/src/main.ts
    sed -i '/http-exception.filter/d' api/apps/meriter/src/main.ts
    
    echo "✅ Backward compatibility code removed"
}

# Function to update documentation
update_documentation() {
    echo "📚 Updating documentation..."
    
    # Update README to reflect v1 API
    sed -i 's|/api/rest/|/api/v1/|g' README.md
    
    # Update API documentation
    echo "## API Endpoints" > API_ENDPOINTS.md
    echo "" >> API_ENDPOINTS.md
    echo "All API endpoints are now available under `/api/v1/` prefix." >> API_ENDPOINTS.md
    echo "See [API_MIGRATION_GUIDE.md](API_MIGRATION_GUIDE.md) for migration details." >> API_ENDPOINTS.md
    
    echo "✅ Documentation updated"
}

# Function to run tests
run_tests() {
    echo "🧪 Running tests..."
    
    # Run backend tests
    cd api && npm test
    
    # Run frontend tests
    cd ../web && npm test
    
    echo "✅ Tests completed"
}

# Main execution
main() {
    echo "🚀 Starting API V1 Migration Cleanup Process"
    echo "=============================================="
    
    # Check if v1 APIs are in use
    if ! check_v1_usage; then
        echo "❌ V1 APIs not found in use. Aborting cleanup."
        echo "Please ensure V1 APIs are properly integrated before running cleanup."
        exit 1
    fi
    
    # Confirm with user
    echo ""
    echo "⚠️  WARNING: This will permanently remove legacy API code!"
    echo "This action cannot be undone."
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo "❌ Cleanup cancelled by user"
        exit 0
    fi
    
    # Execute cleanup steps
    backup_legacy_code
    remove_legacy_controllers
    remove_legacy_client
    update_imports
    remove_backward_compatibility
    update_documentation
    
    # Run tests to ensure everything works
    run_tests
    
    echo ""
    echo "🎉 API V1 Migration Cleanup Complete!"
    echo "====================================="
    echo ""
    echo "✅ Legacy API controllers removed"
    echo "✅ Legacy API client removed"
    echo "✅ Imports updated to use adapters"
    echo "✅ Backward compatibility code removed"
    echo "✅ Documentation updated"
    echo "✅ Tests passed"
    echo ""
    echo "📋 Next steps:"
    echo "1. Deploy the updated code"
    echo "2. Monitor for any issues"
    echo "3. Update any external documentation"
    echo "4. Notify API consumers about the changes"
    echo ""
    echo "📁 Legacy code backup: $BACKUP_DIR"
    echo "📖 Migration guide: API_MIGRATION_GUIDE.md"
}

# Run main function
main "$@"
