# Connecting Your Hostinger Domain to Fly.io

Complete guide for connecting your custom domain (amourscans.com) from Hostinger to your Fly.io deployment.

## Overview

This guide will help you:
1. Get your Fly.io app's IP addresses
2. Configure DNS records in Hostinger
3. Set up SSL certificates (automatic)
4. Verify everything works

**Time Required:** 15 minutes setup + up to 24 hours for DNS propagation

## Prerequisites

- [ ] Fly.io app deployed and running
- [ ] Domain registered with Hostinger (amourscans.com)
- [ ] Fly CLI installed and logged in
- [ ] Access to Hostinger account

## Step 1: Get Fly.io IP Addresses

Open your terminal and run:

```bash
flyctl ips list
```

You'll see output like this:
```
VERSION  IP                      TYPE     REGION  CREATED AT
v6       2a09:8280:1::1:abcd     public   global  2024-11-03
v4       66.241.124.123          public   global  2024-11-03
```

**Write down these IP addresses:**
- IPv4 (v4): `66.241.124.123` (your actual IP will be different)
- IPv6 (v6): `2a09:8280:1::1:abcd` (your actual IP will be different)

If you don't see IP addresses, your app might not be deployed. Run:
```bash
flyctl apps list
flyctl status
```

## Step 2: Add Domain to Fly.io

Tell Fly.io you want to use your custom domain:

```bash
flyctl certs create amourscans.com
flyctl certs create www.amourscans.com
```

You'll see:
```
Your certificate for amourscans.com is being issued.
```

This starts the SSL certificate process. It will complete after DNS is configured.

## Step 3: Login to Hostinger

1. Go to https://www.hostinger.com
2. Click "Login" (top right)
3. Enter your credentials
4. Go to "Domains" in the dashboard

## Step 4: Open DNS Management

1. Find "amourscans.com" in your domain list
2. Click "Manage"
3. Look for "DNS / Name Servers" or "DNS Zone"
4. Click "DNS Records" or "Manage DNS"

You should see a list of DNS records.

## Step 5: Configure DNS Records

You need to add 4 DNS records. Here's what to do:

### Record 1: A Record for Root Domain (amourscans.com)

Click "Add Record" or "Add DNS Record"

```
Type:     A
Name:     @  (or leave blank for root domain)
Content:  66.241.124.123  (your IPv4 from Step 1)
TTL:      14400  (or leave default)
Priority: N/A
```

Click "Add Record" or "Save"

### Record 2: AAAA Record for Root Domain (IPv6)

Click "Add Record"

```
Type:     AAAA
Name:     @  (or leave blank)
Content:  2a09:8280:1::1:abcd  (your IPv6 from Step 1)
TTL:      14400
Priority: N/A
```

Click "Add Record" or "Save"

### Record 3: A Record for WWW Subdomain

Click "Add Record"

```
Type:     A
Name:     www
Content:  66.241.124.123  (same IPv4 as Record 1)
TTL:      14400
Priority: N/A
```

Click "Add Record" or "Save"

### Record 4: AAAA Record for WWW Subdomain

Click "Add Record"

```
Type:     AAAA
Name:     www
Content:  2a09:8280:1::1:abcd  (same IPv6 as Record 2)
TTL:      14400
Priority: N/A
```

Click "Add Record" or "Save"

## Step 6: Remove Conflicting Records (If Any)

Look for existing records that might conflict:

### Delete These If Present:
- **Old A records** pointing to different IPs
- **CNAME records** for @ or www (can't have both A and CNAME)
- **Parking page records** (if domain was parked)

**Keep These:**
- MX records (for email)
- TXT records (for domain verification, SPF, etc.)
- NS records (nameservers)

## Step 7: Verify DNS Configuration

Your DNS records should look like this:

| Type  | Name | Content (Points To)        | TTL   |
|-------|------|----------------------------|-------|
| A     | @    | 66.241.124.123             | 14400 |
| AAAA  | @    | 2a09:8280:1::1:abcd        | 14400 |
| A     | www  | 66.241.124.123             | 14400 |
| AAAA  | www  | 2a09:8280:1::1:abcd        | 14400 |

(Use your actual IP addresses from Step 1)

Click "Save Changes" or "Apply" if there's a final save button.

## Step 8: Wait for DNS Propagation

DNS changes take time to spread across the internet:

- **Minimum:** 5-10 minutes
- **Typical:** 1-2 hours
- **Maximum:** 24-48 hours

### Check DNS Propagation

**Option 1: Command Line**
```bash
# Check if DNS is working
nslookup amourscans.com
nslookup www.amourscans.com

# Or use dig
dig amourscans.com
dig www.amourscans.com
```

**Option 2: Online Tools**
- https://www.whatsmydns.net
- Enter: amourscans.com
- Select: A record
- Check multiple locations worldwide

**What you're looking for:**
Your domain should resolve to the Fly.io IP address (from Step 1).

## Step 9: Verify SSL Certificate

After DNS propagates, check your SSL certificate:

```bash
flyctl certs show amourscans.com
flyctl certs show www.amourscans.com
```

**Wait for this output:**
```
Hostname                = amourscans.com
DNS Validation Hostname = _acme-challenge.amourscans.com
DNS Validation Target   = amourscans.com.z8rv3.flydns.net
Status                  = Ready
```

When Status = "Ready", your SSL is active!

**If Status = "Awaiting DNS":**
- DNS hasn't propagated yet
- Wait 10-30 more minutes
- Check DNS propagation (Step 8)

## Step 10: Test Your Website

### Test Both Domains

Open your browser and visit:

1. **http://amourscans.com** (should redirect to https://)
2. **https://amourscans.com** (should work)
3. **http://www.amourscans.com** (should redirect to https://)
4. **https://www.amourscans.com** (should work)

### What Should Happen:
- ✅ All versions redirect to HTTPS
- ✅ Green padlock icon (secure connection)
- ✅ Your AmourScans website loads
- ✅ No browser security warnings

### If Something's Wrong:
- Check DNS propagation (Step 8)
- Verify IP addresses match (Step 1 vs Step 5)
- Wait longer (up to 24 hours)
- See Troubleshooting section below

## Step 11: Set WWW Redirect (Optional)

To automatically redirect www to non-www (or vice versa):

**In Fly.io (add to fly.toml):**
```toml
[[services.http_checks]]
  interval = "10s"
  timeout = "2s"
  method = "GET"
  path = "/api/health"
  protocol = "http"
```

**Or handle in your app** (already configured in AmourScans).

Most users prefer: `www.amourscans.com` → `amourscans.com`

## Troubleshooting

### DNS Not Propagating?

**Check nameservers:**
```bash
dig NS amourscans.com
```

Make sure Hostinger's nameservers are active (not transferred to another provider).

**Force flush DNS cache (on your computer):**

Windows:
```cmd
ipconfig /flushdns
```

Mac:
```bash
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```

Linux:
```bash
sudo systemd-resolve --flush-caches
```

### SSL Certificate Won't Activate?

**Check DNS is correct:**
```bash
flyctl certs check amourscans.com
```

**View certificate status:**
```bash
flyctl certs show amourscans.com
```

If stuck on "Awaiting DNS":
1. Verify DNS records point to correct IPs
2. Remove any conflicting CNAME records
3. Wait 1-2 hours and check again

**Force certificate refresh:**
```bash
flyctl certs delete amourscans.com
flyctl certs create amourscans.com
```

Wait 10 minutes and check status again.

### Website Shows "Not Found" or 404?

**Check Fly.io app is running:**
```bash
flyctl status
flyctl logs
```

**Verify health endpoint:**
```bash
curl https://your-app-name.fly.dev/api/health
```

Should return:
```json
{"status":"ok","timestamp":"...","database":"connected"}
```

If this works but domain doesn't:
- DNS hasn't propagated yet
- IP addresses incorrect in DNS

### "Connection Not Secure" Warning?

**Common causes:**
1. SSL certificate not ready yet (wait longer)
2. Mixed content (HTTP resources on HTTPS page)
3. DNS pointing to wrong IP

**Fix:**
```bash
flyctl certs show amourscans.com
```

Status should be "Ready" not "Awaiting DNS"

### Both www and non-www Work, But No Redirect?

This is actually fine! Both versions work with SSL.

If you want one to redirect to the other, configure in your app (already done in AmourScans).

## Advanced Configuration

### Email Records (Optional)

If you want to use email with your domain (like admin@amourscans.com):

**Add MX records in Hostinger:**
```
Type: MX
Name: @
Content: mail.hostinger.com
Priority: 10
```

(Check with Hostinger support for their exact MX records)

### Subdomain for API or CDN (Optional)

Create subdomain like api.amourscans.com:

```bash
flyctl certs create api.amourscans.com
```

**Add DNS records:**
```
Type: A
Name: api
Content: (your IPv4)
TTL: 14400
```

### Analytics and SEO

After domain is live, add:
- Google Search Console verification
- Google Analytics
- Sitemap submission

## DNS Record Summary

Here's what your final Hostinger DNS should look like:

```
Type   Name   Content                     TTL    Status
-----  -----  --------------------------  -----  ------
A      @      66.241.124.123              14400  Active
AAAA   @      2a09:8280:1::1:abcd         14400  Active
A      www    66.241.124.123              14400  Active
AAAA   www    2a09:8280:1::1:abcd         14400  Active
NS     @      ns1.hostinger.com           86400  Active
NS     @      ns2.hostinger.com           86400  Active
```

(Plus any MX, TXT, or other records you've added)

## Verification Checklist

Before considering setup complete:

- [ ] Fly.io app deployed and healthy (`flyctl status`)
- [ ] IP addresses obtained (`flyctl ips list`)
- [ ] Certificates created (`flyctl certs create`)
- [ ] A record for @ added to Hostinger DNS
- [ ] AAAA record for @ added to Hostinger DNS
- [ ] A record for www added to Hostinger DNS
- [ ] AAAA record for www added to Hostinger DNS
- [ ] Conflicting records removed
- [ ] DNS propagated (check with nslookup)
- [ ] SSL certificate status = "Ready" (`flyctl certs show`)
- [ ] https://amourscans.com loads correctly
- [ ] https://www.amourscans.com loads correctly
- [ ] Green padlock shows (valid SSL)
- [ ] No browser security warnings

## Quick Reference Commands

```bash
# Get your Fly.io IPs
flyctl ips list

# Create SSL certificates
flyctl certs create amourscans.com
flyctl certs create www.amourscans.com

# Check certificate status
flyctl certs show amourscans.com

# Check DNS propagation
nslookup amourscans.com
dig amourscans.com

# Test health endpoint
curl https://amourscans.com/api/health

# View app logs
flyctl logs

# Check app status
flyctl status
```

## Support Resources

### Hostinger Support
- Live Chat: https://www.hostinger.com/contact
- Knowledge Base: https://support.hostinger.com
- DNS Guides: Search "Hostinger DNS records"

### Fly.io Support
- Documentation: https://fly.io/docs/
- Community: https://community.fly.io/
- Custom Domains Guide: https://fly.io/docs/networking/custom-domain/

### DNS Tools
- DNS Checker: https://www.whatsmydns.net
- SSL Checker: https://www.ssllabs.com/ssltest/
- nslookup online: https://www.nslookup.io

---

**Congratulations!** 🎉 

Once DNS propagates and SSL activates, your website will be live at:
- https://amourscans.com
- https://www.amourscans.com

Both with automatic HTTPS and a valid SSL certificate!

**Next Steps:**
- Add content to your site
- Set up Google Analytics
- Submit sitemap to Google Search Console
- Share your site with the world!
