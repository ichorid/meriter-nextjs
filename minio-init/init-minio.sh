#!/bin/bash
# MinIO initialization script
# Creates the required bucket and sets public read policy
# This script should be run after MinIO is started

set -e

# Configuration from environment variables or defaults
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"
BUCKET_NAME="${S3_BUCKET_NAME:-meriter}"

echo "Initializing MinIO..."
echo "Endpoint: $MINIO_ENDPOINT"
echo "Bucket: $BUCKET_NAME"

# Wait for MinIO to be ready
echo "Waiting for MinIO to be ready..."
until curl -f -s "$MINIO_ENDPOINT/minio/health/live" > /dev/null 2>&1; do
  echo "MinIO is not ready yet, waiting..."
  sleep 2
done

echo "MinIO is ready!"

# Configure MinIO client
export MC_HOST_minio="$MINIO_ROOT_USER:$MINIO_ROOT_PASSWORD@$MINIO_ENDPOINT"

# Check if mc (MinIO Client) is available
if ! command -v mc &> /dev/null; then
  echo "Warning: MinIO Client (mc) is not installed."
  echo "Please install it or configure the bucket manually via MinIO Console:"
  echo "  - Access MinIO Console at http://localhost:9001"
  echo "  - Login with: $MINIO_ROOT_USER / $MINIO_ROOT_PASSWORD"
  echo "  - Create bucket: $BUCKET_NAME"
  echo "  - Set bucket policy to 'public' for read access"
  exit 0
fi

# Create alias for MinIO
mc alias set minio "$MINIO_ENDPOINT" "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"

# Check if bucket exists, create if it doesn't
if mc ls minio | grep -q "$BUCKET_NAME"; then
  echo "Bucket '$BUCKET_NAME' already exists"
else
  echo "Creating bucket '$BUCKET_NAME'..."
  mc mb "minio/$BUCKET_NAME"
  echo "Bucket '$BUCKET_NAME' created successfully"
fi

# Set bucket policy to public read (for serving images)
echo "Setting bucket policy to public read..."
mc anonymous set download "minio/$BUCKET_NAME"

echo "MinIO initialization complete!"
echo "Bucket '$BUCKET_NAME' is ready for use"
echo "Access MinIO Console at http://localhost:9001"

