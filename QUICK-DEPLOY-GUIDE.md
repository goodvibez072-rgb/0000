# Quick Deploy Guide - AmourScans

**Get your manga website online in 10 minutes!**

---

## 🎯 Choose Your Hosting (Pick ONE)

### Option 1: Render.com (100% FREE, Easiest) ⭐ RECOMMENDED

**Perfect for:** Testing, demos, low-traffic sites  
**Cost:** Completely FREE  
**Setup time:** 5 minutes

#### Steps:
1. Push your code to GitHub (or use the export package)
2. Go to https://render.com and sign up
3. Click **"New +" → "Web Service"**
4. Connect your GitHub repository
5. Configure:
   - **Name:** `amourscans`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Add Disk:** Mount path `/app/data`, 1GB
6. Add environment variables:
   ```
   NODE_ENV=production
   ADMIN_EMAIL=your@email.com
   ADMIN_PASSWORD=YourSecure123!
   ```
7. Click **"Create Web Service"**

**Done!** Your site is live in 5-10 minutes at `https://amourscans.onrender.com`

**Note:** Free tier sleeps after 15 min inactivity (wakes up in 30 seconds on visit)

---

### Option 2: Railway.app (FREE $5 credit, No Sleep)

**Perfect for:** Active sites, testing with real users  
**Cost:** $0 ($5 free credit = ~500 hours/month)  
**Setup time:** 5 minutes

#### Steps:
1. Push code to GitHub
2. Go to https://railway.app and sign up
3. Click **"New Project" → "Deploy from GitHub"**
4. Select your repository
5. Go to **"Volumes"** → **"New Volume"**
   - Mount path: `/app/data`
6. Add environment variables in "Variables" tab:
   ```
   NODE_ENV=production
   ADMIN_EMAIL=your@email.com
   ADMIN_PASSWORD=YourSecure123!
   ```
7. Click **"Deploy"**

**Done!** Live at `https://amourscans.up.railway.app`

**Note:** Stays online 24/7, no auto-sleep!

---

### Option 3: Hostinger VPS ($4.99/month)

**Perfect for:** Production sites, full control, custom domain  
**Cost:** $4.99/month (often 40-60% off)  
**Setup time:** 20 minutes

#### Steps:
1. **Buy VPS:** https://www.hostinger.com/vps-hosting
   - Select **Ubuntu 22.04 with Node.js** template
   
2. **Package your project:**
   ```bash
   ./export-for-hosting.sh
   # Creates: amourscans-[timestamp].tar.gz
   ```

3. **Upload via SFTP:**
   - Use FileZilla: https://filezilla-project.org/
   - Connect to your VPS IP with credentials from Hostinger
   - Upload the .tar.gz file

4. **SSH into VPS and deploy:**
   ```bash
   ssh root@your-vps-ip
   cd /var/www/html
   tar -xzf /root/amourscans-*.tar.gz
   npm ci --only=production
   
   # Create .env file
   nano .env
   # Add: NODE_ENV=production, ADMIN_EMAIL, ADMIN_PASSWORD
   
   # Start with PM2
   npm install -g pm2
   pm2 start dist/index.js --name amourscans
   pm2 save && pm2 startup
   ```

5. **Setup Nginx:**
   See `HOSTINGER-DEPLOYMENT.md` for full Nginx config

**Done!** Live at `http://your-vps-ip`

---

## 📦 Export Package Method (For Any Platform)

If you want to manually upload your project:

### 1. Create Deployment Package

```bash
# Make script executable (first time only)
chmod +x export-for-hosting.sh

# Run export script
./export-for-hosting.sh
```

This creates: `amourscans-[timestamp].tar.gz`

### 2. What's Inside

```
amourscans-deployment/
├── dist/                   # Built frontend and backend
├── server/                 # Server source code
├── shared/                 # Shared schemas
├── data/                   # SQLite database
│   ├── database.db        # Your data (persists!)
│   └── backups/           # Database backups
├── package.json           # Dependencies
├── .env.example          # Environment template
├── DEPLOY-NOW.txt        # Quick instructions
└── Deployment guides     # Full documentation
```

### 3. Deploy to Any Platform

**On your hosting platform:**

```bash
# 1. Extract package
tar -xzf amourscans-[timestamp].tar.gz
cd amourscans-deployment

# 2. Create .env file
cp .env.example .env
nano .env  # Add your settings

# 3. Install dependencies
npm install --only=production

# 4. Start application
npm start
```

**Your site is now live!**

---

## ⚙️ Required Environment Variables

Create a `.env` file with these:

```env
# REQUIRED
NODE_ENV=production
ADMIN_PASSWORD=YourSecurePassword123!

# RECOMMENDED
ADMIN_EMAIL=admin@yourdomain.com
PRODUCTION_URL=https://your-domain.com

# OPTIONAL (add features)
STRIPE_SECRET_KEY=sk_live_...          # For payments
SENDGRID_API_KEY=SG...                 # For emails
GOOGLE_CLIENT_ID=...                   # For Google login
```

See `.env.example` for all options.

---

## 🔍 After Deployment Checklist

1. **Access your site** at the provided URL
2. **Test admin login** with credentials from .env
3. **Upload test manga** to verify file uploads work
4. **Restart server** and verify data persists
5. **Change default password** if you used default
6. **Set up backups** (run `npm run db:backup` weekly)

---

## ❓ Common Questions

### Which platform should I choose?

| Use Case | Platform | Reason |
|----------|----------|--------|
| **Just testing** | Render | Completely free, easy |
| **Real users, low traffic** | Railway | No sleep, free credit |
| **Production site** | Hostinger VPS | Full control, custom domain |
| **High traffic** | Hostinger VPS | Best performance |

### Can I use free hosting forever?

**Render:** Yes, but sleeps after 15 min inactivity  
**Railway:** $5/month credit renews, lasts 500 hours  
**Hostinger:** No free option

### Do I need a domain?

**No!** All platforms give you a free subdomain:
- Render: `yourapp.onrender.com`
- Railway: `yourapp.up.railway.app`
- Hostinger: Use VPS IP or add custom domain

### What about the database?

Your SQLite database is included in the package!
- **Already has:** Admin account, all your data
- **Persists:** Data survives restarts (if you use persistent storage)
- **Backups:** Run `npm run db:backup` regularly

---

## 🆘 Need Help?

1. **Check detailed guides:**
   - `DEPLOYMENT.md` - Complete deployment guide
   - `HOSTINGER-DEPLOYMENT.md` - Hostinger VPS guide
   - `HOSTING-CHECKLIST.md` - Pre-deployment checklist

2. **Common issues:**
   - Site not loading → Check deployment logs
   - Admin can't login → Verify .env ADMIN_PASSWORD
   - Database resets → Ensure persistent storage mounted

3. **Platform documentation:**
   - Render: https://render.com/docs
   - Railway: https://docs.railway.app
   - Hostinger: https://support.hostinger.com

---

## 🚀 Ready to Deploy!

**Recommended path for beginners:**
1. Start with **Render** (free, easy)
2. Test your site thoroughly
3. When ready for production, upgrade to **Hostinger VPS**

**Your manga website will be online in minutes!**

Good luck! 🎉
