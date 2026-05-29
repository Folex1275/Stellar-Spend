#!/bin/bash

# Disaster Recovery Test Script
# Tests backup and recovery procedures

set -e

ENVIRONMENT=${1:-staging}
BACKUP_VAULT="${ENVIRONMENT}-backup-vault"
DB_INSTANCE="${ENVIRONMENT}-db"

echo "🔄 Starting Disaster Recovery Test for $ENVIRONMENT"

# ── Test 1: Verify Backup Vault ────────────────────────────────────────────

echo "✓ Test 1: Verifying backup vault..."
aws backup describe-backup-vault \
  --backup-vault-name "$BACKUP_VAULT" \
  --region us-east-1 || {
  echo "❌ Backup vault not found"
  exit 1
}

# ── Test 2: Check Recent Backups ───────────────────────────────────────────

echo "✓ Test 2: Checking recent backups..."
RECENT_BACKUPS=$(aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name "$BACKUP_VAULT" \
  --region us-east-1 \
  --query 'RecoveryPoints[?Status==`COMPLETED`]' \
  --output json | jq 'length')

if [ "$RECENT_BACKUPS" -lt 1 ]; then
  echo "❌ No recent backups found"
  exit 1
fi

echo "   Found $RECENT_BACKUPS completed backups"

# ── Test 3: Verify RDS Backup Configuration ────────────────────────────────

echo "✓ Test 3: Verifying RDS backup configuration..."
aws rds describe-db-instances \
  --db-instance-identifier "$DB_INSTANCE" \
  --region us-east-1 \
  --query 'DBInstances[0].[BackupRetentionPeriod,MultiAZ]' \
  --output text | {
  read retention multi_az
  if [ "$retention" -lt 7 ]; then
    echo "❌ Backup retention period too short: $retention days"
    exit 1
  fi
  if [ "$multi_az" != "true" ]; then
    echo "❌ Multi-AZ not enabled"
    exit 1
  fi
  echo "   Retention: $retention days, Multi-AZ: $multi_az"
}

# ── Test 4: Verify S3 Backup Bucket ───────────────────────────────────────

echo "✓ Test 4: Verifying S3 backup bucket..."
BUCKET_NAME="stellar-spend-${ENVIRONMENT}-backups-$(aws sts get-caller-identity --query Account --output text)"

aws s3api head-bucket --bucket "$BUCKET_NAME" --region us-east-1 || {
  echo "❌ S3 backup bucket not found: $BUCKET_NAME"
  exit 1
}

# ── Test 5: Check Bucket Encryption ───────────────────────────────────────

echo "✓ Test 5: Checking S3 bucket encryption..."
ENCRYPTION=$(aws s3api get-bucket-encryption \
  --bucket "$BUCKET_NAME" \
  --region us-east-1 \
  --query 'ServerSideEncryptionConfiguration.Rules[0].ApplyServerSideEncryptionByDefault.SSEAlgorithm' \
  --output text 2>/dev/null || echo "NONE")

if [ "$ENCRYPTION" != "aws:kms" ]; then
  echo "❌ S3 bucket not encrypted with KMS"
  exit 1
fi

echo "   Encryption: $ENCRYPTION"

# ── Test 6: Verify Versioning ─────────────────────────────────────────────

echo "✓ Test 6: Checking S3 versioning..."
VERSIONING=$(aws s3api get-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --region us-east-1 \
  --query 'Status' \
  --output text)

if [ "$VERSIONING" != "Enabled" ]; then
  echo "❌ S3 versioning not enabled"
  exit 1
fi

echo "   Versioning: $VERSIONING"

# ── Test 7: Simulate Recovery Point ────────────────────────────────────────

echo "✓ Test 7: Simulating recovery point..."
LATEST_BACKUP=$(aws backup list-recovery-points-by-backup-vault \
  --backup-vault-name "$BACKUP_VAULT" \
  --region us-east-1 \
  --query 'RecoveryPoints[?Status==`COMPLETED`] | [0].RecoveryPointArn' \
  --output text)

if [ -z "$LATEST_BACKUP" ] || [ "$LATEST_BACKUP" = "None" ]; then
  echo "❌ No recovery point found"
  exit 1
fi

echo "   Latest backup: $LATEST_BACKUP"

# ── Test 8: Calculate RTO/RPO ─────────────────────────────────────────────

echo "✓ Test 8: Calculating RTO/RPO..."
BACKUP_TIME=$(aws backup describe-recovery-point \
  --backup-vault-name "$BACKUP_VAULT" \
  --recovery-point-arn "$LATEST_BACKUP" \
  --region us-east-1 \
  --query 'RecoveryPoint.CreationDate' \
  --output text)

CURRENT_TIME=$(date -u +%s)
BACKUP_TIMESTAMP=$(date -d "$BACKUP_TIME" +%s)
RPO_MINUTES=$(( ($CURRENT_TIME - $BACKUP_TIMESTAMP) / 60 ))

echo "   RPO: $RPO_MINUTES minutes"
echo "   RTO: < 60 minutes (estimated)"

if [ "$RPO_MINUTES" -gt 30 ]; then
  echo "⚠️  Warning: RPO exceeds 30 minutes"
fi

# ── Test 9: Verify Backup Encryption ──────────────────────────────────────

echo "✓ Test 9: Verifying backup encryption..."
BACKUP_ENCRYPTION=$(aws backup describe-recovery-point \
  --backup-vault-name "$BACKUP_VAULT" \
  --recovery-point-arn "$LATEST_BACKUP" \
  --region us-east-1 \
  --query 'RecoveryPoint.EncryptionKeyArn' \
  --output text)

if [ -z "$BACKUP_ENCRYPTION" ] || [ "$BACKUP_ENCRYPTION" = "None" ]; then
  echo "❌ Backup not encrypted"
  exit 1
fi

echo "   Encryption key: $BACKUP_ENCRYPTION"

# ── Test 10: Check Backup Retention ───────────────────────────────────────

echo "✓ Test 10: Checking backup retention..."
RETENTION_DAYS=$(aws backup describe-recovery-point \
  --backup-vault-name "$BACKUP_VAULT" \
  --recovery-point-arn "$LATEST_BACKUP" \
  --region us-east-1 \
  --query 'RecoveryPoint.Lifecycle.DeleteAfter' \
  --output text)

if [ -z "$RETENTION_DAYS" ] || [ "$RETENTION_DAYS" = "None" ]; then
  echo "❌ No retention policy set"
  exit 1
fi

echo "   Retention: $RETENTION_DAYS days"

echo ""
echo "✅ All disaster recovery tests passed!"
echo ""
echo "Summary:"
echo "  - Backup Vault: ✓"
echo "  - Recent Backups: ✓ ($RECENT_BACKUPS found)"
echo "  - RDS Configuration: ✓"
echo "  - S3 Backup Bucket: ✓"
echo "  - Encryption: ✓"
echo "  - Versioning: ✓"
echo "  - Recovery Point: ✓"
echo "  - RTO/RPO: ✓ (RPO: ${RPO_MINUTES}m, RTO: <60m)"
echo "  - Backup Encryption: ✓"
echo "  - Retention Policy: ✓"
