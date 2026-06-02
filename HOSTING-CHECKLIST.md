# Hosting Checklist - AmourScans

Quick reference checklist for deploying AmourScans to production. Complete this before deploying to ensure a smooth launch.

---

## Pre-Deployment Checklist

### 1. Code & Dependencies

- [ ] All code changes committed to git
- [ ] No uncommitted changes or experimental code
- [ ] Dependencies up to date (`npm install` runs without errors)
- [ ] No dev dependencies in production build
- [ ] `.gitignore` includes `.env` and sensitive files

### 2. Environment Variables

#### Required (Must Set)
- [ ] `NODE_ENV=production`
- [ ] `PRODUCTION_URL` (your actual domain URL)
- [ ] `ADMIN_PASSWORD` (strong, unique password)

#### Recommended
- [ ] `ADMIN_EMAIL` (your admin email)
- [ ] `ADMIN_USERNAME` (custom admin username)
- [ ] `PORT` (if platform requires specific port)

#### Optional Features
- [ ] Email service configured (SendGrid or SMTP)
- [ ] Stripe keys set (if using payments)
- [ ] OAuth credentials (Google/Discord if using social login)

**Note:** Never commit `.env` file to git. Use platform's secret manager.

### 3. Database Setup

- [ ] Database initialized locally (`npm run db:init`)
- [ ] Admin user created successfully
- [ ] Test content added and verified
- [ ] Database backup created (`npm run db:backup`)
- [ ] Backup downloaded and stored safely

**For Production:**
- [ ] Persistent storage configured (volume/disk for SQLite)
- [ ] Mount path set to `/app/data` (platform-specific)
- [ ] Sufficient storage allocated (1GB+ recommended)

### 4. Build & Test

- [ ] Production build succeeds (`npm run build`)
- [ ] Build output in `dist/` directory
- [ ] No build errors or warnings
- [ ] Production server starts (`npm start`)
- [ ] Server accessible at http://localhost:5000
- [ ] Admin login works locally
- [ ] File uploads work locally
- [ ] Database persists after restart

### 5. Security

- [ ] Strong admin password (minimum 12 characters)
- [ ] Default credentials changed
- [ ] Admin email not using default `@localhost.com`
- [ ] HTTPS enforced (automatic on most platforms)
- [ ] Secrets stored in platform secret manager (not in code)
- [ ] No API keys or passwords in git history
- [ ] CORS configured correctly
- [ ] CSP headers enabled (already configured)
- [ ] Rate limiting enabled (already configured)

### 6. Platform Configuration

Choose your platform and complete the relevant checklist:

#### Replit
- [ ] Project uploaded/imported to Replit
- [ ] Environment variables added to Secrets
- [ ] **VM deployment selected** (NOT Autoscale)
- [ ] Build command: `npm run build`
- [ ] Start command: `npm start`
- [ ] Deployment URL noted

#### Railway
- [ ] GitHub repository connected
- [ ] Build command configured: `npm run build`
- [ ] Start command configured: `npm start`
- [ ] **Volume created and mounted** at `/app/data`
- [ ] Environment variables added
- [ ] Custom domain configured (optional)

#### Render
- [ ] Repository connected to Render
- [ ] **Starter tier selected** (NOT Free tier - needs persistence)
- [ ] Build command: `npm install && npm run build`
- [ ] Start command: `npm start`
- [ ] **Persistent disk added** (1GB minimum)
- [ ] Disk mount path: `/app/data`
- [ ] Environment variables configured

#### Fly.io
- [ ] Fly CLI installed and authenticated
- [ ] `fly.toml` created in project root
- [ ] **Volume created:** `fly volumes create data --size 1`
- [ ] Volume mount configured in fly.toml
- [ ] Secrets set via `fly secrets set`
- [ ] App region selected

### 7. Domain & SSL

- [ ] Domain purchased (or using platform subdomain)
- [ ] DNS configured to point to deployment
- [ ] SSL certificate issued (automatic on most platforms)
- [ ] HTTPS redirect working (already configured in code)
- [ ] `PRODUCTION_URL` matches actual domain

### 8. File Storage

- [ ] Upload directory configured (`data/uploads`)
- [ ] Write permissions verified
- [ ] Persistent storage for uploads (same as database)
- [ ] File size limits configured (already set: 10MB)

---

## Deployment Day Checklist

### Before Clicking Deploy

- [ ] All code tested locally
- [ ] Database backup created and downloaded
- [ ] Environment variables double-checked
- [ ] Deployment configuration reviewed
- [ ] Persistent storage verified

### During Deployment

- [ ] Monitor deployment logs in real-time
- [ ] Watch for build errors
- [ ] Note any warnings
- [ ] **Save auto-generated admin password** (if shown in logs)

### After Deployment

- [ ] Site accessible at deployment URL
- [ ] Homepage loads correctly
- [ ] No console errors in browser
- [ ] CSS and images load properly
- [ ] Admin login page accessible
- [ ] Can login with admin credentials

---

## Post-Deployment Verification

### Immediate Tests (First 10 Minutes)

1. **Access Test**
   - [ ] Visit deployment URL
   - [ ] Homepage loads without errors
   - [ ] No 404 or 500 errors

2. **Admin Test**
   - [ ] Navigate to `/admin` or `/login`
   - [ ] Login with admin credentials
   - [ ] Admin dashboard loads
   - [ ] All admin menu items accessible

3. **Database Test**
   - [ ] Add a test manga series
   - [ ] Upload a test chapter
   - [ ] Verify content displays
   - [ ] Edit content
   - [ ] Delete content
   - [ ] Verify changes persist

4. **File Upload Test**
   - [ ] Upload manga cover image
   - [ ] Upload chapter images
   - [ ] Images display correctly
   - [ ] Image URLs work

5. **Persistence Test**
   - [ ] Add content to database
   - [ ] Restart application/server
   - [ ] Verify content still exists
   - [ ] Upload files remain accessible

### Extended Tests (First Hour)

6. **User Registration** (if enabled)
   - [ ] Register new user account
   - [ ] Login with new account
   - [ ] Verify user permissions
   - [ ] Test logout/login cycle

7. **Performance Test**
   - [ ] Homepage loads in under 3 seconds
   - [ ] No slow queries in logs
   - [ ] Images load quickly
   - [ ] Navigation is responsive

8. **Mobile Test**
   - [ ] Access site on mobile device
   - [ ] Touch interactions work
   - [ ] Layout responsive
   - [ ] Images sized correctly

9. **SEO Test**
   - [ ] View page source
   - [ ] Meta tags present
   - [ ] Sitemap accessible at `/sitemap.xml`
   - [ ] Robots.txt accessible

10. **Security Test**
    - [ ] HTTPS active (lock icon in browser)
    - [ ] HTTP redirects to HTTPS
    - [ ] No mixed content warnings
    - [ ] CSP headers present (check dev tools)

---

## Ongoing Maintenance Checklist

### Daily
- [ ] Check deployment logs for errors
- [ ] Monitor uptime
- [ ] Verify site accessibility

### Weekly
- [ ] Create database backup
- [ ] Download and store backup safely
- [ ] Check disk space usage
- [ ] Review performance metrics

### Monthly
- [ ] Update dependencies (`npm update`)
- [ ] Test full backup/restore process
- [ ] Review security logs
- [ ] Check for platform updates

### Quarterly
- [ ] Audit admin accounts
- [ ] Review and rotate secrets/passwords
- [ ] Performance optimization review
- [ ] Security audit

---

## Troubleshooting Quick Reference

### Site Not Accessible
1. Check deployment status (should be "running")
2. Verify domain/DNS configuration
3. Check deployment logs for errors
4. Ensure correct port binding (5000 or platform default)

### Database Issues
1. Verify persistent storage is mounted
2. Check file permissions in `/app/data`
3. Restore from backup if corrupted
4. Ensure SQLite WAL mode enabled (automatic)

### Admin Login Fails
1. Check admin credentials in deployment logs
2. Reset password: `npm run admin:create`
3. Verify database initialized correctly
4. Check for typos in username/password

### Build Failures
1. Check Node.js version (requires 18+)
2. Clear build cache and retry
3. Verify all dependencies installed
4. Check platform build logs for specific error

### Files Not Uploading
1. Check persistent storage configured
2. Verify write permissions in `/app/data/uploads`
3. Check file size limits (default: 10MB)
4. Review upload logs for errors

---

## Platform-Specific Quick Checks

### Replit
- ✅ VM deployment (not Autoscale)
- ✅ Secrets configured
- ✅ Build command: `npm run build`
- ✅ Run command: `npm start`

### Railway
- ✅ Volume mounted at `/app/data`
- ✅ Environment variables set
- ✅ Auto-deploy enabled (optional)

### Render
- ✅ Starter tier (not Free tier)
- ✅ Persistent disk added
- ✅ Disk mounted at `/app/data`
- ✅ Build & start commands correct

### Fly.io
- ✅ Volume created and mounted
- ✅ fly.toml configured
- ✅ Secrets set via CLI

---

## Environment Variables Quick Reference

Copy this template and fill in your values:

```env
# REQUIRED
NODE_ENV=production
PRODUCTION_URL=https://your-domain.com
ADMIN_PASSWORD=YourSecurePassword123!

# RECOMMENDED
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_USERNAME=admin

# OPTIONAL - Email
SENDGRID_API_KEY=your_sendgrid_key
# OR
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# OPTIONAL - Payments
STRIPE_SECRET_KEY=sk_live_your_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret

# OPTIONAL - OAuth
GOOGLE_CLIENT_ID=your_google_id
GOOGLE_CLIENT_SECRET=your_google_secret
DISCORD_CLIENT_ID=your_discord_id
DISCORD_CLIENT_SECRET=your_discord_secret
```

---

## Emergency Contacts & Resources

### Documentation
- Full deployment guide: `DEPLOYMENT.md`
- Environment variables: `.env.example`
- Project documentation: `README.md`

### Platform Status Pages
- Replit: https://status.replit.com
- Railway: https://status.railway.app
- Render: https://status.render.com
- Fly.io: https://status.flyio.net

### Database Commands
```bash
npm run db:init       # Initialize database
npm run db:backup     # Create backup
npm run db:restore    # Restore from backup
npm run db:verify     # Check database health
npm run db:reset      # Reset database (CAUTION: deletes all data)
```

### Admin Commands
```bash
npm run admin:create  # Create new admin user
```

---

## Final Checklist Before Going Live

- [ ] All tests passed
- [ ] Database backup created and stored
- [ ] Admin credentials saved securely
- [ ] Monitoring set up (optional but recommended)
- [ ] Domain configured (if using custom domain)
- [ ] Team members have access credentials
- [ ] Rollback plan in place
- [ ] Support contacts documented

**Ready to deploy? Follow the steps in `DEPLOYMENT.md`**

---

**Good luck with your deployment! 🚀**

For detailed instructions, see `DEPLOYMENT.md`.
For help, check the Troubleshooting section in `DEPLOYMENT.md`.
