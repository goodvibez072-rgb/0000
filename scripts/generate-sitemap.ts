#!/usr/bin/env npx tsx
/**
 * Sitemap Generator for MangaVerse
 * Generates sitemap.xml for search engine optimization
 * Run this script after major content updates or on a schedule
 */

import Database from "better-sqlite3";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";

const dbPath = "./data/database.db";
const sitemapPath = "./public/sitemap.xml";
const baseUrl = process.env.PRODUCTION_URL || "https://your-domain.com"; // Set PRODUCTION_URL environment variable

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
}

function generateSitemapXml(urls: SitemapUrl[]): string {
  const header = '<?xml version="1.0" encoding="UTF-8"?>\n' +
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
  
  const urlEntries = urls.map(url => {
    let entry = `\n  <url>\n    <loc>${url.loc}</loc>`;
    if (url.lastmod) entry += `\n    <lastmod>${url.lastmod}</lastmod>`;
    if (url.changefreq) entry += `\n    <changefreq>${url.changefreq}</changefreq>`;
    if (url.priority !== undefined) entry += `\n    <priority>${url.priority.toFixed(1)}</priority>`;
    entry += '\n  </url>';
    return entry;
  }).join('');
  
  const footer = '\n</urlset>';
  
  return header + urlEntries + footer;
}

function formatDate(date: Date | string | null): string {
  if (!date) return new Date().toISOString().split('T')[0];
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

async function generateSitemap() {
  console.log("🗺️  MangaVerse Sitemap Generator\n");
  console.log("=" .repeat(50));

  if (!existsSync(dbPath)) {
    console.error("❌ Database file not found:", dbPath);
    process.exit(1);
  }

  const db = new Database(dbPath, { readonly: true });
  const urls: SitemapUrl[] = [];

  try {
    // 1. Homepage (highest priority)
    urls.push({
      loc: baseUrl,
      changefreq: "daily",
      priority: 1.0,
      lastmod: formatDate(new Date())
    });

    // 2. Main pages
    const mainPages = [
      { path: "/browse", changefreq: "daily" as const, priority: 0.9 },
      { path: "/shop", changefreq: "weekly" as const, priority: 0.8 },
      { path: "/subscriptions", changefreq: "weekly" as const, priority: 0.8 },
      { path: "/battle-pass", changefreq: "weekly" as const, priority: 0.7 },
      { path: "/flash-sales", changefreq: "daily" as const, priority: 0.7 },
      { path: "/achievements", changefreq: "monthly" as const, priority: 0.6 },
      { path: "/daily-rewards", changefreq: "daily" as const, priority: 0.6 },
      { path: "/dmca", changefreq: "yearly" as const, priority: 0.3 },
      { path: "/terms", changefreq: "yearly" as const, priority: 0.3 },
      { path: "/privacy", changefreq: "yearly" as const, priority: 0.3 },
    ];

    mainPages.forEach(page => {
      urls.push({
        loc: `${baseUrl}${page.path}`,
        changefreq: page.changefreq,
        priority: page.priority,
        lastmod: formatDate(new Date())
      });
    });

    // 3. Series pages
    console.log("\n📚 Fetching series...");
    const series = db.prepare(`
      SELECT id, title, updated_at 
      FROM series 
      WHERE status IS NOT NULL
      ORDER BY updated_at DESC
    `).all() as Array<{ id: string; title: string; updated_at: string }>;

    console.log(`Found ${series.length} series`);

    series.forEach(s => {
      urls.push({
        loc: `${baseUrl}/series/${s.id}`,
        changefreq: "weekly",
        priority: 0.9,
        lastmod: formatDate(s.updated_at)
      });
    });

    // 4. Chapter pages
    console.log("\n📖 Fetching chapters...");
    const chapters = db.prepare(`
      SELECT c.id, c.series_id, c.chapter_number, c.created_at,
             s.title as series_title
      FROM chapters c
      JOIN series s ON c.series_id = s.id
      ORDER BY c.created_at DESC
      LIMIT 1000
    `).all() as Array<{ 
      id: string; 
      series_id: string; 
      chapter_number: string; 
      created_at: string;
      series_title: string;
    }>;

    console.log(`Found ${chapters.length} chapters`);

    chapters.forEach(c => {
      urls.push({
        loc: `${baseUrl}/series/${c.series_id}/chapter/${c.chapter_number}`,
        changefreq: "monthly",
        priority: 0.8,
        lastmod: formatDate(c.created_at)
      });
    });

    // 5. Generate XML
    console.log("\n📝 Generating sitemap XML...");
    const sitemapXml = generateSitemapXml(urls);

    // 6. Write to file
    console.log("\n💾 Writing sitemap to:", sitemapPath);
    writeFileSync(sitemapPath, sitemapXml, 'utf-8');

    // 7. Statistics
    console.log("\n📊 Sitemap Statistics:");
    console.log(`  Total URLs: ${urls.length}`);
    console.log(`  Homepage: 1`);
    console.log(`  Main pages: ${mainPages.length}`);
    console.log(`  Series: ${series.length}`);
    console.log(`  Chapters: ${chapters.length}`);
    console.log(`  File size: ${(sitemapXml.length / 1024).toFixed(2)} KB`);

    console.log("\n✅ Sitemap generated successfully!");
    console.log(`\n📍 Location: ${sitemapPath}`);
    console.log(`🌐 URL: ${baseUrl}/sitemap.xml`);
    
    console.log("\n📌 Next Steps:");
    console.log("  1. Submit sitemap to Google Search Console");
    console.log("  2. Submit sitemap to Bing Webmaster Tools");
    console.log("  3. Add sitemap reference to robots.txt:");
    console.log(`     Sitemap: ${baseUrl}/sitemap.xml`);
    console.log("  4. Schedule this script to run daily/weekly");

  } catch (error) {
    console.error("\n❌ Error generating sitemap:", error);
    process.exit(1);
  } finally {
    db.close();
  }
}

// Run the generator
generateSitemap().catch(console.error);
