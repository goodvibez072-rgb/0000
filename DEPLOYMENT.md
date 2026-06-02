# AmourScans Deployment Guide

Complete guide for deploying AmourScans to production on Replit and other hosting platforms.

## Table of Contents
- [Quick Start (Replit)](#quick-start-replit)
- [Environment Variables](#environment-variables)
- [Deploying on Replit](#deploying-on-replit)
- [Deploying on Other Platforms](#deploying-on-other-platforms)
- [Database Migration](#database-migration)
- [Post-Deployment](#post-deployment)
- [Troubleshooting](#troubleshooting)

---

## Quick Start (Replit)

**Replit is the easiest and recommended platform for deploying AmourScans.** The SQLite database persists automatically, and deployment takes just a few clicks.

### Prerequisites
- A Replit account (free tier works)
- Your project uploaded to Replit

### Deploy in 3 Steps

1. **Configure Environment Variables** (Optional but recommended)
   - Go to the "Secrets" tab (lock icon) in Replit
   - Add these key variables:
     ```
     NODE_ENV=production
     PRODUCTION_URL=https://your-repl-name.your-username.repl.co
     ADMIN_EMAIL=your-email@example.com
     ADMIN_PASSWORD=your-secure-password
     ```

2. **Click the "Deploy" Button**
   - Click "Deploy" in the top navigation
   - Choose **"Reserved VM"** deployment (required for SQLite)
   - The deployment uses these settings:
     - Build: `npm run build`
     - Run: `npm start`

3. **Access Your Site**
   - Your site will be live at: `https://your-repl-name.your-username.repl.co`
   - Admin credentials are displayed in deployment logs (if auto-generated)

**That's it!** Your manga platform is now live with persistent storage.

---

## Environment Variables

### Required for Production

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PRODUCTION_URL` | Your full domain URL | `https://your-app.com` |
| `ADMIN_PASSWORD` | Admin account password | `SecurePass123!` |

### Optional (Recommended)

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_EMAIL` | Admin email address | `admin@localhost.com` |
| `ADMIN_USERNAME` | Admin username | `admin` |
| `PORT` | Server port | `5000` |
| `DATABASE_PATH` | SQLite database path | `./data/database.db` |

### Optional Features

#### Email (Password Reset)
```env
# SendGrid (Recommended)
SENDGRID_API_KEY=your_sendgrid_api_key

# OR SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

#### Payments (Stripe)
```env
STRIPE_SECRET_KEY=sk_live_your_stripe_secret
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

#### Social Login (OAuth)
```env
# Google
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Discord
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
```

**See `.env.example` for complete configuration options.**

---

## Deploying on Replit

### Step-by-Step Guide

#### 1. Upload Your Project
- Create a new Repl or import from GitHub
- Ensure all files are uploaded

#### 2. Set Environment Variables
- Click the **Secrets** (lock icon) in the left sidebar
- Add your environment variables one by one:
  ```
  Key: NODE_ENV
  Value: production
  
  Key: PRODUCTION_URL
  Value: https://your-repl-url.repl.co
  
  Key: ADMIN_EMAIL
  Value: your-email@example.com
  
  Key: ADMIN_PASSWORD
  Value: YourSecurePassword123!
  ```

#### 3. Initialize Database (Development Mode)
Before deploying, test locally:
```bash
npm run db:init
```
This creates the database and admin user.

#### 4. Deploy
1. Click **"Deploy"** in the top menu
2. Select **"Reserved VM"** deployment type
   - **IMPORTANT:** SQLite databases require Reserved VM, not Autoscale
   - VM deployments ensure your database file persists
3. Review configuration:
   - Build command: `npm run build`
   - Run command: `npm start`
4. Click **"Deploy"**

#### 5. Monitor Deployment
- Check the deployment logs for any errors
- Look for the admin credentials if auto-generated
- Save the generated admin password immediately

#### 6. Verify Deployment
- Visit your deployment URL
- Test login with admin credentials
- Upload some manga content to verify functionality

### Custom Domain (Optional)
1. Go to your deployment settings
2. Click "Add custom domain"
3. Follow Replit's instructions to configure DNS
4. Update `PRODUCTION_URL` environment variable

---

## Deploying on Other Platforms

AmourScans can be deployed on various Node.js hosting platforms. Here are guides for popular free options.

### Railway.app

**Why Railway?** Free tier, automatic deployments, great for SQLite apps.

#### Setup Steps

1. **Create Railway Account**
   - Sign up at [railway.app](https://railway.app)
   - Connect your GitHub account

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your AmourScans repository

3. **Configure Build Settings**
   Railway auto-detects Node.js. Verify these settings:
   ```
   Build Command: npm run build
   Start Command: npm start
   ```

4. **Add Environment Variables**
   Go to Variables tab and add:
   ```
   NODE_ENV=production
   PRODUCTION_URL=https://your-app.railway.app
   ADMIN_EMAIL=your-email@example.com
   ADMIN_PASSWORD=YourSecurePassword123!
   ```

5. **Enable Volume for SQLite**
   **CRITICAL:** SQLite needs persistent storage
   - Go to Settings → Volumes
   - Mount path: `/app/data`
   - This ensures your database persists across deployments

6. **Deploy**
   - Click "Deploy"
   - Monitor logs for admin credentials
   - Access your app at the provided Railway URL

#### Railway Tips
- Free tier: 500 hours/month, $5 credit
- Database persists with volume mounting
- Automatic SSL certificates
- GitHub integration for auto-deployments

---

### Render.com

**Why Render?** Free tier, easy setup, built-in persistence.

#### Setup Steps

1. **Create Render Account**
   - Sign up at [render.com](https://render.com)
   - Connect GitHub

2. **Create Web Service**
   - Dashboard → New → Web Service
   - Connect your repository
   - Select branch (usually `main`)

3. **Configure Service**
   ```
   Name: amourscans
   Environment: Node
   Build Command: npm install && npm run build
   Start Command: npm start
   ```

4. **Set Instance Type**
   - Choose **"Starter"** (free tier with persistent disk)
   - NOT "Free tier" (ephemeral, loses data)

5. **Add Environment Variables**
   ```
   NODE_ENV=production
   PRODUCTION_URL=https://your-app.onrender.com
   ADMIN_EMAIL=your-email@example.com
   ADMIN_PASSWORD=YourSecurePassword123!
   ```

6. **Enable Persistent Disk**
   **REQUIRED for SQLite:**
   - Go to "Disks" section
   - Add persistent disk
   - Mount path: `/app/data`
   - Size: 1GB (free tier limit)

7. **Deploy**
   - Click "Create Web Service"
   - Wait for build to complete (5-10 minutes)
   - Access your app at the Render URL

#### Render Tips
- Free tier has limitations (spins down after inactivity)
- Persistent disk ensures database survival
- Auto-deploys on git push
- Custom domains available

---

### Fly.io (Recommended for Custom Domains)

**Why Fly.io?** Great free tier (3 small VMs, 3GB storage), full VM control, global deployment, excellent custom domain support.

**Perfect for:** First deployment, permanent hosting, custom domains (like amourscans.com)

#### Prerequisites
- Fly.io account (sign up at https://fly.io/app/sign-up)
- Fly CLI installed on your computer
- Your project files ready to deploy

#### Complete Step-by-Step Guide

**Step 1: Install Fly CLI**

On Windows:
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

On Mac:
```bash
curl -L https://fly.io/install.sh | sh
```

On Linux:
```bash
curl -L https://fly.io/install.sh | sh
```

Verify installation:
```bash
flyctl version
```

**Step 2: Login to Fly.io**
```bash
flyctl auth login
```
Your browser will open to complete login.

**Step 3: Create Your App**
```bash
flyctl apps create amourscans
```
If "amourscans" is taken, try: `amourscans-manga`, `amourscans-reader`, or `yourname-amourscans`

**Step 4: Create Persistent Volume for SQLite Database**

This is CRITICAL - your database needs permanent storage:
```bash
flyctl volumes create amourscans_data --region sjc --size 1
```

**Explanation:**
- `amourscans_data` - Volume name (must match fly.toml)
- `--region sjc` - San Jose, California (choose closest to your users)
- `--size 1` - 1GB storage (free tier includes 3GB total)

**Popular Regions:**
- `iad` - Washington D.C. (East Coast USA)
- `sjc` - San Jose (West Coast USA)
- `lhr` - London (Europe)
- `fra` - Frankfurt (Europe)
- `syd` - Sydney (Australia)
- `nrt` - Tokyo (Asia)

**Step 5: Configure fly.toml**

Your project already includes `fly.toml`. Update the app name:
```toml
app = "amourscans"  # Match your app name from Step 3
```

The fly.toml is already optimized for AmourScans with:
- Docker build configuration
- Port 8080 (Fly.io requirement)
- Health checks at /api/health
- Persistent volume mount at /data
- Environment variables for database paths

**Step 6: Deploy to Fly.io**
```bash
flyctl deploy
```

**What happens during deployment:**
1. Builds Docker image (3-5 minutes first time)
2. Uploads to Fly.io registry
3. Creates VM instance
4. Mounts persistent volume
5. Starts your application
6. Runs health checks

**You'll see:**
```
==> Building image
...
==> Pushing image to fly
...
==> Deploying
...
 1 desired, 1 placed, 1 healthy, 0 unhealthy [health checks: 1 total, 1 passing]
--> v0 deployed successfully
```

**Step 7: Set Environment Variables (Optional)**

Set any needed secrets:
```bash
# Example: Stripe keys
flyctl secrets set STRIPE_SECRET_KEY=sk_live_xxxxx
flyctl secrets set STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx

# Example: Admin credentials
flyctl secrets set ADMIN_EMAIL=admin@amourscans.com
flyctl secrets set ADMIN_PASSWORD=YourSecurePassword123

# Example: Session secret
flyctl secrets set SESSION_SECRET=$(openssl rand -base64 32)
```

After setting secrets, app restarts automatically.

**Step 8: Access Your Site**

Open in browser:
```bash
flyctl open
```

Your site is now live at: `https://your-app-name.fly.dev`

Check status:
```bash
flyctl status
```

View logs:
```bash
flyctl logs
```

**Step 9: Connect Custom Domain**

See the "Custom Domain Setup" section below or DNS_SETUP.md for connecting your Hostinger domain.

#### Fly.io Management Commands

**View real-time logs:**
```bash
flyctl logs
```

**Restart app:**
```bash
flyctl apps restart
```

**SSH into container:**
```bash
flyctl ssh console
```

**Check database volume:**
```bash
flyctl volumes list
```

**Check app status:**
```bash
flyctl status
```

**View dashboard:**
```bash
flyctl dashboard
```

**Update after code changes:**
```bash
flyctl deploy
```

**Scale resources (may require paid plan):**
```bash
# Increase memory
flyctl scale memory 512

# Add more VMs
flyctl scale count 2
```

#### Custom Domain Setup (Quick Guide)

**Add your domain to Fly.io:**
```bash
flyctl certs create amourscans.com
flyctl certs create www.amourscans.com
```

**Get DNS records to add:**
```bash
flyctl ips list
```

You'll see:
- IPv4: `66.241.xxx.xxx`
- IPv6: `2a09:8280:1::xxxx`

**Add these to Hostinger DNS:**
1. Go to Hostinger DNS management
2. Add A record: `@` → IPv4 address
3. Add AAAA record: `@` → IPv6 address
4. Add A record: `www` → IPv4 address
5. Add AAAA record: `www` → IPv6 address

**Verify SSL certificate:**
```bash
flyctl certs show amourscans.com
```

Wait 5-10 minutes for DNS propagation. See DNS_SETUP.md for detailed instructions.

#### Backup Your Database on Fly.io

**Download database backup:**
```bash
# SSH into container
flyctl ssh console

# Create backup
cd /data
cp database.db database-backup-$(date +%Y%m%d).db
exit

# Download to your computer
flyctl ssh sftp get /data/database.db ./local-backup.db
```

**Upload database (restore):**
```bash
flyctl ssh sftp shell
put ./local-backup.db /data/database.db
exit
flyctl apps restart
```

#### Troubleshooting Fly.io

**App won't start?**
```bash
flyctl logs
```
Common issues:
- Volume not mounted (check fly.toml mounts section)
- Wrong port (must be 8080)
- Database path incorrect

**Database resets on deploy?**
Check volume is mounted:
```bash
flyctl volumes list
```
Ensure fly.toml has:
```toml
[mounts]
  source = "amourscans_data"
  destination = "/data"
```

**Out of memory?**
Free tier has 256MB RAM. Upgrade:
```bash
flyctl scale memory 512
```
(Requires paid plan)

**SSL certificate issues?**
```bash
flyctl certs show amourscans.com
```
Wait for DNS propagation (up to 24 hours)

**App is slow?**
Check region matches your users:
```bash
flyctl status
```

#### Fly.io Free Tier Details
- **3 shared VMs** (shared-cpu-1x, 256MB RAM each)
- **3GB persistent storage** total across all volumes
- **160GB** outbound data transfer per month
- **Automatic SSL certificates** (Let's Encrypt)
- **Global Anycast network**

Perfect for manga websites with moderate traffic!

#### Monitoring & Maintenance

**Health checks:**
Your app includes `/api/health` endpoint that Fly.io monitors automatically.

**View metrics:**
```bash
flyctl dashboard
```

**Resource usage:**
```bash
flyctl status
flyctl vm status
```

**Performance monitoring:**
Fly.io dashboard shows:
- Request count
- Response times
- Error rates
- Resource usage

---

### Heroku (With Considerations)

**Note:** Heroku's ephemeral filesystem makes SQLite challenging. Consider using PostgreSQL or another platform.

If you still want to use Heroku:

1. **Add Procfile**
   ```
   web: npm start
   ```

2. **Use PostgreSQL Instead**
   ```bash
   heroku addons:create heroku-postgresql:mini
   ```
   
   You'll need to modify the app to use PostgreSQL instead of SQLite.

**Recommendation:** Use Railway or Render instead for SQLite apps.

---

## Database Migration

### Backup Before Migration

Always backup your database before moving platforms:

```bash
npm run db:backup production-migration
```

This creates: `./data/backups/production-migration-[timestamp].db`

### Moving Between Platforms

#### From Local to Production
1. Build and test locally
2. Run `npm run db:init` to create initial database
3. Deploy to platform
4. Database auto-initializes on first run

#### From Replit to Another Platform
1. Download database file from Replit:
   - Shell → `cd data && zip database.zip database.db`
   - Download `database.zip`
2. Upload to new platform's persistent storage
3. Extract in `/app/data/` directory
4. Restart application

#### From One Platform to Another
1. **Export database:**
   ```bash
   npm run db:backup migration
   ```
   
2. **Download backup:**
   - Find in `./data/backups/`
   - Download to local machine

3. **Upload to new platform:**
   - Upload backup to new platform
   - Place in `./data/` folder
   - Rename to `database.db`

4. **Verify:**
   ```bash
   npm run db:verify
   ```

### Database Reset (Caution)

To start fresh (DELETES ALL DATA):
```bash
npm run db:reset
```

---

## Post-Deployment

### Immediate Checks

1. **Verify Site Access**
   - Visit your deployment URL
   - Check homepage loads correctly

2. **Test Admin Login**
   - Go to `/admin` or `/login`
   - Login with admin credentials
   - Verify admin dashboard access

3. **Upload Test Content**
   - Add a manga series
   - Upload a chapter
   - Verify images load correctly

4. **Check Database Persistence**
   - Add content
   - Restart app/server
   - Verify content still exists

### Security Checklist

- [ ] Strong admin password set
- [ ] `NODE_ENV=production` configured
- [ ] HTTPS enabled (automatic on most platforms)
- [ ] Admin email changed from default
- [ ] Secrets stored in platform's secret manager
- [ ] `.env` file NOT committed to git

### Performance Optimization

1. **Enable Compression**
   Already configured in the app

2. **CDN (Optional)**
   - Cloudflare (free tier)
   - Point domain to deployment
   - Automatic caching and DDoS protection

3. **Monitor Performance**
   - Check deployment logs regularly
   - Monitor disk space for database growth
   - Set up uptime monitoring (UptimeRobot, etc.)

### Backup Strategy

Set up automatic backups:

```bash
# Backup database weekly (add to cron/scheduler)
npm run db:backup weekly-auto
```

On platforms with cron jobs:
- Railway: Use cron job service
- Render: Add cron job in settings
- Fly.io: Use fly-cron

---

## Troubleshooting

### Build Failures

**Error: `npm install` fails**
- Solution: Check Node.js version (requires 18+)
- Run: `node --version`

**Error: Build exceeds memory limit**
- Solution: Increase build memory or reduce dependencies
- Railway/Render: Upgrade tier
- Replit: Ensure correct plan

### Runtime Errors

**Database not found**
```
Error: SQLITE_CANTOPEN: unable to open database file
```
- Solution: Ensure persistent storage is configured
- Check volume/disk is mounted at `/app/data`
- Verify write permissions

**Admin user not created**
- Check deployment logs for admin credentials
- Run manually: `npm run admin:create`
- Ensure `ADMIN_PASSWORD` is set

**Port binding error**
```
Error: listen EADDRINUSE :::5000
```
- Solution: Platform may require different port
- Set `PORT` environment variable
- Check platform's default port requirements

### Database Issues

**Database locked**
```
Error: SQLITE_BUSY: database is locked
```
- Solution: SQLite WAL mode already configured
- If persists, restart application
- Check for multiple instances running

**Database corrupted**
```
Error: SQLITE_CORRUPT: database disk image is malformed
```
- Solution: Restore from backup
- Run: `npm run db:restore`
- Choose latest backup file

### Performance Issues

**Slow page loads**
- Check database size (run `ls -lh data/`)
- Optimize images (already configured)
- Enable CDN (Cloudflare)

**High memory usage**
- Review database queries in logs
- Check for memory leaks (update dependencies)
- Increase platform resources

### Platform-Specific Issues

**Replit: Deployment won't start**
- Verify VM deployment selected (not Autoscale)
- Check environment variables format
- Review deployment logs

**Railway: Database resets on deploy**
- Ensure volume is mounted
- Check mount path: `/app/data`
- Verify volume size

**Render: Free tier spins down**
- Normal behavior after 15 min inactivity
- First request wakes it up (30s delay)
- Upgrade to paid tier for 24/7 uptime

**Fly.io: Volume not accessible**
- Verify volume created: `fly volumes list`
- Check mount path in fly.toml
- Ensure region matches app region

---

## Support & Resources

### Official Documentation
- [Replit Deployments](https://docs.replit.com/hosting/deployments/about-deployments)
- [Railway Docs](https://docs.railway.app/)
- [Render Docs](https://render.com/docs)
- [Fly.io Docs](https://fly.io/docs/)

### Application Scripts
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run db:init` - Initialize database
- `npm run db:backup` - Backup database
- `npm run db:restore` - Restore from backup
- `npm run db:verify` - Verify database health
- `npm run admin:create` - Create admin user

### Getting Help
- Check deployment logs first
- Review this guide's troubleshooting section
- Check platform status pages
- Contact platform support

---

## Next Steps

After successful deployment:

1. **Configure Custom Domain** (optional)
2. **Set Up Monitoring** (UptimeRobot, etc.)
3. **Configure Backups** (automated schedule)
4. **Add Content** (manga series, chapters)
5. **Enable Additional Features:**
   - Email (SendGrid/SMTP)
   - Payments (Stripe)
   - Social Login (Google/Discord)

See `.env.example` for feature-specific configuration.

---

**Congratulations! Your manga platform is now live!**

For additional configuration and feature setup, refer to:
- `HOSTING-CHECKLIST.md` - Pre-deployment checklist
- `.env.example` - Complete environment variable reference
- `README.md` - Project documentation
