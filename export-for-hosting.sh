#!/bin/bash

# AmourScans Export Script for Hosting
# Creates a clean deployment package ready to upload to any hosting platform

set -e

echo "📦 AmourScans Deployment Package Creator"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the project directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Create export directory
EXPORT_DIR="amourscans-deployment"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EXPORT_FILE="amourscans-${TIMESTAMP}.tar.gz"

echo "${BLUE}Step 1: Backing up database...${NC}"
if [ -f "data/database.db" ]; then
    npm run db:backup
    echo "${GREEN}✓ Database backed up${NC}"
else
    echo "${YELLOW}⚠ No database found - will be created on first run${NC}"
fi

echo ""
echo "${BLUE}Step 2: Building production version...${NC}"
npm run build
echo "${GREEN}✓ Build complete${NC}"

echo ""
echo "${BLUE}Step 3: Creating deployment package...${NC}"

# Create temporary export directory
rm -rf $EXPORT_DIR
mkdir -p $EXPORT_DIR

# Copy necessary files
echo "  Copying files..."
cp package.json $EXPORT_DIR/
cp package-lock.json $EXPORT_DIR/
cp .env.example $EXPORT_DIR/
cp README.md $EXPORT_DIR/
cp DEPLOYMENT.md $EXPORT_DIR/
cp HOSTING-CHECKLIST.md $EXPORT_DIR/
cp HOSTINGER-DEPLOYMENT.md $EXPORT_DIR/

# Copy directories
echo "  Copying directories..."
cp -r dist $EXPORT_DIR/
cp -r server $EXPORT_DIR/
cp -r shared $EXPORT_DIR/
cp -r data $EXPORT_DIR/
cp -r scripts $EXPORT_DIR/

# Remove unnecessary files from data
rm -f $EXPORT_DIR/data/sessions.db
rm -f $EXPORT_DIR/data/*.db-shm
rm -f $EXPORT_DIR/data/*.db-wal

# Create deployment instructions
cat > $EXPORT_DIR/DEPLOY-NOW.txt << 'EOF'
🚀 AMOURSCANS DEPLOYMENT INSTRUCTIONS
=====================================

QUICK START:
1. Extract this folder to your hosting platform
2. Run: npm install --only=production
3. Run: npm start
4. Access at http://your-server:5000

ENVIRONMENT VARIABLES (Optional):
Create a .env file (see .env.example for all options):

NODE_ENV=production
PRODUCTION_URL=http://your-domain.com
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=your_secure_password

DEPLOYMENT GUIDES:
- DEPLOYMENT.md - Complete guide for all platforms
- HOSTINGER-DEPLOYMENT.md - Specific guide for Hostinger VPS
- HOSTING-CHECKLIST.md - Pre-deployment checklist

FREE HOSTING OPTIONS:
✅ Render.com - Easiest, 750 hours/month free
✅ Railway.app - $5 free credit/month, no sleep
✅ Fly.io - Global deployment, 3 free VMs

PAID HOSTING:
✅ Hostinger VPS - $4.99/month, full control

DATABASE:
- SQLite database at: data/database.db
- Will auto-initialize on first run
- Admin credentials in deployment logs

SUPPORT:
- Read DEPLOYMENT.md for detailed instructions
- Check HOSTING-CHECKLIST.md before deploying
- Database backup in: data/backups/

IMPORTANT:
⚠️ Always use platforms with PERSISTENT STORAGE for SQLite
⚠️ Set strong ADMIN_PASSWORD before deploying
⚠️ Backup database regularly with: npm run db:backup

Your manga website is ready to deploy! 🎉
EOF

echo "${GREEN}✓ Package created${NC}"

echo ""
echo "${BLUE}Step 4: Creating compressed archive...${NC}"
tar -czf $EXPORT_FILE $EXPORT_DIR
echo "${GREEN}✓ Archive created: ${EXPORT_FILE}${NC}"

# Get file size
SIZE=$(du -h $EXPORT_FILE | cut -f1)

echo ""
echo "${GREEN}════════════════════════════════════════${NC}"
echo "${GREEN}✅ Deployment package ready!${NC}"
echo "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "📦 Package: ${EXPORT_FILE}"
echo "📏 Size: ${SIZE}"
echo ""
echo "📝 Next Steps:"
echo "  1. Download: ${EXPORT_FILE}"
echo "  2. Read: DEPLOY-NOW.txt (inside package)"
echo "  3. Choose hosting: See DEPLOYMENT.md"
echo "  4. Upload and deploy!"
echo ""
echo "🎯 Recommended Free Hosting:"
echo "  • Render.com (easiest)"
echo "  • Railway.app (no sleep)"
echo "  • Fly.io (advanced)"
echo ""
echo "💰 Paid Hosting:"
echo "  • Hostinger VPS (\$4.99/month)"
echo ""
echo "${YELLOW}⚠️  Important:${NC}"
echo "  - Your database is included (data/database.db)"
echo "  - Set ADMIN_PASSWORD before deploying"
echo "  - Use platforms with persistent storage"
echo ""

# Cleanup
rm -rf $EXPORT_DIR

echo "${GREEN}Done! Ready to deploy your manga website! 🚀${NC}"
