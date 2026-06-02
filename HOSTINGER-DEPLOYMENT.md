# Hostinger Deployment Guide for AmourScans

Complete guide for deploying your manga website to Hostinger hosting.

---

## ⚠️ CRITICAL: Hosting Requirements

**AmourScans uses SQLite database which requires:**
- ✅ **Persistent file storage** (database file must survive restarts)
- ✅ **Node.js support** (version 18 or higher)
- ✅ **Write permissions** (to create/modify database files)

### Hostinger Options:

| Hosting Type | SQLite Support | Cost | Recommended |
|-------------|----------------|------|-------------|
| **Shared Hosting** | ❌ NO | $2-4/month | ❌ Not compatible |
| **VPS Hosting** | ✅ YES | $4.99/month | ✅ **Use this** |
| **Cloud Hosting** | ❌ NO | $9/month | ❌ Not compatible |

**You MUST use VPS Hosting for AmourScans.**

---

## Option 1: Hostinger VPS Deployment (Recommended)

### Step 1: Get Hostinger VPS

1. **Purchase VPS Plan:**
   - Go to https://www.hostinger.com/vps-hosting
   - Choose **VPS 1** plan ($4.99/month - often discounted 40-60%)
   - Select template: **Ubuntu 22.04 64-bit with Node.js**

2. **Wait for VPS Setup:**
   - You'll receive email with:
     - VPS IP address
     - Root password
     - SSH access details

### Step 2: Prepare Your Project

On Replit or your local machine, create a deployment package:

```bash
# 1. Backup your database
npm run db:backup

# 2. Build production version
npm run build

# 3. Create deployment package
tar -czf amourscans-deploy.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=.replit \
  --exclude=.env \
  dist/ \
  server/ \
  shared/ \
  data/ \
  package.json \
  package-lock.json \
  .env.example

# Download amourscans-deploy.tar.gz to your computer
```

### Step 3: Upload to Hostinger VPS

**Method A: Using SFTP (Easiest)**

1. **Download FileZilla** (free SFTP client): https://filezilla-project.org/

2. **Connect to VPS:**
   - Host: `your-vps-ip-address`
   - Username: `root`
   - Password: (from Hostinger email)
   - Port: `22`

3. **Upload files:**
   - Upload `amourscans-deploy.tar.gz` to `/root/`
   - Or drag and drop individual folders

**Method B: Using SSH Command Line**

```bash
# From your computer
scp amourscans-deploy.tar.gz root@your-vps-ip:/root/
```

### Step 4: Install and Configure on VPS

**SSH into your VPS:**
```bash
ssh root@your-vps-ip
# Enter password from Hostinger email
```

**Setup Application:**
```bash
# Navigate to web directory
cd /var/www/html

# Extract deployment package
tar -xzf /root/amourscans-deploy.tar.gz

# Install dependencies (production only)
npm ci --only=production

# Create production .env file
nano .env
```

**Add to .env file:**
```env
NODE_ENV=production
PORT=5000
PRODUCTION_URL=http://your-vps-ip:5000
ADMIN_EMAIL=your@email.com
ADMIN_PASSWORD=YourSecurePassword123!
DATABASE_PATH=/var/www/html/data/database.db
```

Save and exit (Ctrl+X, Y, Enter)

**Set permissions:**
```bash
# Ensure data directory is writable
chmod 755 /var/www/html/data
chmod 644 /var/www/html/data/*.db

# Fix ownership
chown -R www-data:www-data /var/www/html
```

### Step 5: Install PM2 (Process Manager)

```bash
# Install PM2 globally
npm install -g pm2

# Start application
cd /var/www/html
pm2 start dist/index.js --name amourscans

# Save PM2 configuration
pm2 save

# Enable PM2 to start on boot
pm2 startup
# Copy and run the command it outputs
```

### Step 6: Configure Web Server

**Install and configure Nginx:**

```bash
# Install Nginx
apt update
apt install nginx -y

# Create Nginx configuration
nano /etc/nginx/sites-available/amourscans
```

**Add this configuration:**
```nginx
server {
    listen 80;
    server_name your-vps-ip;  # Change to your domain if you have one

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Enable the site:**
```bash
# Create symbolic link
ln -s /etc/nginx/sites-available/amourscans /etc/nginx/sites-enabled/

# Remove default site
rm /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

# Restart Nginx
systemctl restart nginx
```

### Step 7: Access Your Site

Your site is now live at: `http://your-vps-ip`

**Test it:**
1. Visit the IP address in your browser
2. Login with admin credentials from .env file
3. Upload test manga content
4. Restart VPS and verify data persists

### Step 8: Custom Domain (Optional)

If you have a domain name:

1. **In domain registrar (Namecheap, GoDaddy, etc.):**
   - Add A record pointing to your VPS IP
   - Example: `manga.yourdomain.com` → `your-vps-ip`

2. **Update Nginx config:**
   ```bash
   nano /etc/nginx/sites-available/amourscans
   # Change: server_name your-vps-ip;
   # To: server_name manga.yourdomain.com;
   
   systemctl restart nginx
   ```

3. **Update .env:**
   ```bash
   nano /var/www/html/.env
   # Change: PRODUCTION_URL=http://your-vps-ip:5000
   # To: PRODUCTION_URL=https://manga.yourdomain.com
   
   pm2 restart amourscans
   ```

### Step 9: Add SSL Certificate (Recommended)

```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get SSL certificate (replace with your domain)
certbot --nginx -d manga.yourdomain.com

# Auto-renewal is enabled automatically
```

---

## Option 2: Free Alternatives to Hostinger

If you don't want to pay for Hostinger VPS, use these **completely free** platforms:

### 🆓 Render.com (Best Free Option)

**Pros:**
- Completely free tier
- 750 hours/month (enough for testing)
- Persistent disk for SQLite
- Auto-deploy from GitHub
- Free SSL certificates

**Cons:**
- Sleeps after 15 minutes of inactivity
- 30-60 second cold start time

**Quick Setup:**
1. Push your code to GitHub
2. Go to https://render.com
3. New → Web Service → Connect GitHub
4. Configure:
   - Build: `npm install && npm run build`
   - Start: `npm start`
   - Add Persistent Disk: `/app/data` (1GB free)
5. Add environment variables (NODE_ENV, ADMIN_EMAIL, etc.)
6. Deploy!

Full guide: See `DEPLOYMENT.md` → Render section

---

### 🆓 Railway.app (No Sleep!)

**Pros:**
- $5 free credits per month
- No auto-sleep (stays online 24/7)
- Persistent volumes
- GitHub integration

**Cons:**
- Limited to credit usage ($5/month ≈ 500 hours)

**Quick Setup:**
1. Push to GitHub
2. Go to https://railway.app
3. New Project → Deploy from GitHub
4. Add Volume: `/app/data`
5. Add environment variables
6. Deploy!

Full guide: See `DEPLOYMENT.md` → Railway section

---

### 🆓 Fly.io (Global Deployment)

**Pros:**
- Free tier: 3 VMs with shared CPU
- Global edge deployment
- Persistent volumes
- No auto-sleep

**Cons:**
- Requires CLI setup
- More technical

**Quick Setup:**
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch app
fly launch

# Create volume for database
fly volumes create data --size 1

# Deploy
fly deploy
```

Full guide: See `DEPLOYMENT.md` → Fly.io section

---

## Maintenance & Updates

### Update Application on VPS

```bash
# SSH into VPS
ssh root@your-vps-ip

# Navigate to app directory
cd /var/www/html

# Backup database first!
npm run db:backup

# Pull latest changes (if using git)
git pull

# Or upload new files via SFTP

# Rebuild
npm run build

# Restart application
pm2 restart amourscans
```

### Monitor Application

```bash
# Check application status
pm2 status

# View logs
pm2 logs amourscans

# Monitor resources
pm2 monit

# Check Nginx status
systemctl status nginx
```

### Backup Database

```bash
# On VPS
cd /var/www/html
npm run db:backup

# Download backup to your computer via SFTP
# File location: /var/www/html/data/backups/
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs amourscans --lines 50

# Common issues:
# 1. Port already in use
pm2 delete amourscans
pm2 start dist/index.js --name amourscans

# 2. Database permissions
chmod 755 /var/www/html/data
chmod 644 /var/www/html/data/*.db

# 3. Missing dependencies
npm ci --only=production
```

### Site Not Accessible

```bash
# Check Nginx status
systemctl status nginx

# Check Nginx error logs
tail -f /var/log/nginx/error.log

# Test Nginx configuration
nginx -t

# Restart Nginx
systemctl restart nginx
```

### Database Issues

```bash
# Verify database exists
ls -la /var/www/html/data/

# Test database
cd /var/www/html
npm run db:verify

# Reset if needed (CAUTION: deletes data!)
npm run db:reset
```

---

## Cost Comparison

| Platform | Monthly Cost | Database Storage | Auto-Sleep | Setup Difficulty |
|----------|-------------|------------------|------------|------------------|
| **Hostinger VPS** | $4.99 | Unlimited* | Never | Medium |
| **Render Free** | $0 | 1GB | After 15min | Easy |
| **Railway Free** | $0 ($5 credit) | 1GB | Never | Easy |
| **Fly.io Free** | $0 | 1GB | No | Hard |

*Unlimited within VPS storage limits (20GB on basic plan)

---

## Recommendation

### For Testing/Development:
Use **Render.com** (completely free, easy setup)

### For Production:
- **Small traffic (<1000 users/day):** Render free or Railway
- **Medium traffic:** Hostinger VPS ($4.99/month)
- **High traffic:** Upgrade to larger VPS or cloud hosting

---

## Next Steps

1. **Choose your platform** (Hostinger VPS or free alternative)
2. **Follow the relevant guide** above
3. **Test thoroughly** before going live
4. **Set up backups** (crucial for SQLite!)
5. **Monitor performance** and upgrade as needed

For detailed deployment instructions for free platforms, see **`DEPLOYMENT.md`**

---

**Questions?** Check `DEPLOYMENT.md` and `HOSTING-CHECKLIST.md` for more details.
