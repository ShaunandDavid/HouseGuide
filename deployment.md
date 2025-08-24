# HouseGuide Production Deployment Guide

## Overview
This guide provides comprehensive instructions for deploying HouseGuide to production.

## Pre-Deployment Checklist

### 1. Environment Configuration
- [ ] Copy `.env.production.example` to `.env.production`
- [ ] Set all required environment variables
- [ ] Verify JWT_SECRET is at least 32 characters
- [ ] Configure FRONTEND_URL with HTTPS
- [ ] Set up SendGrid API key and verified sender email
- [ ] Configure database connection string

### 2. Database Setup
```bash
# Run database migrations
npm run db:push

# Verify database connection
npm run db:health
```

### 3. Security Verification
```bash
# Run security audit
npm audit --production

# Run production readiness checks
./scripts/production-checks.sh
```

### 4. Build Application
```bash
# Install production dependencies
npm ci --production

# Build frontend and backend
npm run build

# Verify build output
ls -la dist/
```

## Deployment Process

### Option 1: Deploy to Replit (Recommended)

1. **Environment Variables**
   - Go to Secrets tab in Replit
   - Add all production environment variables
   - Ensure NODE_ENV is set to "production"

2. **Deploy via Replit Deployments**
   ```bash
   # The application will auto-deploy when you push to main branch
   # Or manually trigger deployment from Replit UI
   ```

3. **Configure Domain**
   - Go to Deployments tab
   - Add custom domain
   - Configure SSL certificate

### Option 2: Deploy to Cloud Provider

#### Google Cloud Platform
```bash
# Install gcloud CLI
# Configure project
gcloud config set project houseguide-production

# Deploy to App Engine
gcloud app deploy

# Set environment variables
gcloud app update --env-vars-file=.env.production
```

#### AWS
```bash
# Using Elastic Beanstalk
eb init -p node.js houseguide
eb create production
eb setenv $(cat .env.production | xargs)
eb deploy
```

#### Heroku
```bash
# Create Heroku app
heroku create houseguide-production

# Set buildpacks
heroku buildpacks:set heroku/nodejs

# Deploy
git push heroku main

# Set environment variables
heroku config:set $(cat .env.production)
```

## Post-Deployment Tasks

### 1. Health Checks
```bash
# Check application health
curl https://your-domain.com/api/health

# Check detailed health status
curl https://your-domain.com/api/health/detailed
```

### 2. Enable Monitoring
- Set up Sentry for error tracking
- Configure DataDog or similar for metrics
- Enable CloudWatch/Stackdriver logging

### 3. Configure Backups
```bash
# Enable automated backups
export ENABLE_BACKUPS=true
export BACKUP_SCHEDULE="0 2 * * *"  # Daily at 2 AM

# Test backup system
npm run backup:test
```

### 4. SSL/TLS Configuration
- Ensure HTTPS is enforced
- Configure SSL certificates
- Set up auto-renewal

### 5. Performance Optimization
- Enable CDN (CloudFlare recommended)
- Configure caching headers
- Enable gzip compression

## Monitoring & Maintenance

### Key Metrics to Monitor
- Response time: < 200ms (p50), < 1s (p99)
- Error rate: < 0.1%
- Database connections: < 80% of pool
- Memory usage: < 80% of allocated
- CPU usage: < 70% sustained

### Regular Maintenance Tasks
- **Daily**: Review error logs, check backup status
- **Weekly**: Review performance metrics, update dependencies
- **Monthly**: Security audit, database optimization
- **Quarterly**: Disaster recovery drill, penetration testing

## Rollback Procedure

If issues occur after deployment:

1. **Immediate Rollback**
   ```bash
   # Revert to previous deployment
   git revert HEAD
   git push origin main
   ```

2. **Database Rollback**
   ```bash
   # Restore from backup
   npm run db:restore --backup=backup-2024-01-15.sql.gz
   ```

3. **Feature Flags**
   - Disable problematic features via environment variables
   - No code deployment needed

## Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Verify connection string
psql $DATABASE_URL -c "SELECT 1"

# Check connection pool
npm run db:pool:status
```

#### High Memory Usage
```bash
# Increase Node memory limit
export NODE_OPTIONS="--max-old-space-size=2048"

# Restart application
npm run restart
```

#### Authentication Issues
```bash
# Verify JWT secret
echo $JWT_SECRET | wc -c  # Should be >= 32

# Check CORS configuration
curl -I -X OPTIONS https://your-api.com/api/test \
  -H "Origin: https://your-frontend.com"
```

## Security Best Practices

1. **Regular Updates**
   - Run `npm audit` weekly
   - Update dependencies monthly
   - Apply security patches immediately

2. **Access Control**
   - Use principle of least privilege
   - Rotate API keys quarterly
   - Enable 2FA for admin accounts

3. **Data Protection**
   - Encrypt sensitive data at rest
   - Use HTTPS for all communications
   - Implement rate limiting

4. **Incident Response**
   - Have incident response plan ready
   - Configure alerting for anomalies
   - Maintain audit logs

## Support Contacts

- **Technical Issues**: dev-team@houseguide.com
- **Security Issues**: security@houseguide.com
- **24/7 Support**: +1-xxx-xxx-xxxx
- **Escalation**: cto@houseguide.com

## Appendix

### Environment Variables Reference
See `.env.production.example` for complete list

### API Documentation
Available at `/api/docs` when deployed

### Database Schema
See `shared/schema.ts` for complete schema

### Monitoring Dashboards
- Metrics: `/api/metrics` (requires METRICS_KEY)
- Health: `/api/health/detailed`
- Errors: Check Sentry dashboard

---

Last Updated: 2024
Version: 1.0.0