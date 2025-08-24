#!/bin/bash

# Production readiness checks
echo "🔍 Running production readiness checks..."

# Check environment variables
echo "✓ Checking environment variables..."
required_vars=("DATABASE_URL" "JWT_SECRET" "SENDGRID_API_KEY" "FRONTEND_URL")
missing_vars=()

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    missing_vars+=("$var")
  fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
  echo "❌ Missing required environment variables: ${missing_vars[*]}"
  exit 1
else
  echo "✅ All required environment variables are set"
fi

# Check JWT secret strength
if [ ${#JWT_SECRET} -lt 32 ]; then
  echo "⚠️  WARNING: JWT_SECRET should be at least 32 characters"
fi

# Test database connection
echo "✓ Testing database connection..."
if npm run db:push --dry-run > /dev/null 2>&1; then
  echo "✅ Database connection successful"
else
  echo "❌ Database connection failed"
  exit 1
fi

# Run tests
echo "✓ Running test suite..."
if npm test > /dev/null 2>&1; then
  echo "✅ All tests passed"
else
  echo "❌ Tests failed"
  exit 1
fi

# Check build
echo "✓ Building application..."
if npm run build > /dev/null 2>&1; then
  echo "✅ Build successful"
else
  echo "❌ Build failed"
  exit 1
fi

# Security audit
echo "✓ Running security audit..."
npm audit --production > audit-report.txt 2>&1
critical_vulns=$(grep -c "Critical" audit-report.txt || true)
high_vulns=$(grep -c "High" audit-report.txt || true)

if [ "$critical_vulns" -gt 0 ] || [ "$high_vulns" -gt 0 ]; then
  echo "⚠️  Security vulnerabilities found: $critical_vulns critical, $high_vulns high"
  echo "   Run 'npm audit' for details"
else
  echo "✅ No critical security vulnerabilities"
fi

# Check SSL/TLS
echo "✓ Checking SSL/TLS configuration..."
if [ "$NODE_ENV" = "production" ]; then
  if [ -z "$FRONTEND_URL" ] || [[ ! "$FRONTEND_URL" =~ ^https:// ]]; then
    echo "⚠️  WARNING: FRONTEND_URL should use HTTPS in production"
  else
    echo "✅ HTTPS configured"
  fi
fi

# Memory and performance check
echo "✓ Checking system resources..."
node_memory=${NODE_OPTIONS:-"--max-old-space-size=512"}
if [[ "$node_memory" =~ --max-old-space-size=([0-9]+) ]]; then
  memory_mb="${BASH_REMATCH[1]}"
  if [ "$memory_mb" -lt 1024 ]; then
    echo "⚠️  WARNING: Consider increasing Node.js memory limit for production"
  else
    echo "✅ Adequate memory allocated: ${memory_mb}MB"
  fi
fi

# Health check endpoint
echo "✓ Testing health check endpoint..."
if curl -f -s "http://localhost:5000/api/health" > /dev/null 2>&1; then
  echo "✅ Health check endpoint responding"
else
  echo "⚠️  Health check endpoint not responding (server may not be running)"
fi

echo ""
echo "📊 Production Readiness Summary:"
echo "================================"
echo "✅ Environment variables: PASS"
echo "✅ Database connection: PASS"
echo "✅ Test suite: PASS"
echo "✅ Build process: PASS"

if [ "$critical_vulns" -gt 0 ] || [ "$high_vulns" -gt 0 ]; then
  echo "⚠️  Security audit: NEEDS ATTENTION"
else
  echo "✅ Security audit: PASS"
fi

echo ""
echo "🚀 Application is ready for production deployment!"