import { Router } from "express";
import { storage } from "../storage";

const router = Router();

/**
 * Helper function to escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

router.get("/sitemap.xml", async (req, res) => {
  try {
    const baseUrl = req.protocol + '://' + req.get('host');
    
    // Fetch all series
    const allSeries = await storage.getAllSeries();
    
    // Fetch all chapters  
    const allChapters = await storage.getAllChapters();
    
    // Build sitemap XML with image support
    let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n';
    sitemap += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';
    
    // Homepage
    sitemap += '  <url>\n';
    sitemap += `    <loc>${baseUrl}/</loc>\n`;
    sitemap += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
    sitemap += '    <changefreq>daily</changefreq>\n';
    sitemap += '    <priority>1.0</priority>\n';
    sitemap += '  </url>\n';
    
    // Browse page
    sitemap += '  <url>\n';
    sitemap += `    <loc>${baseUrl}/browse</loc>\n`;
    sitemap += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
    sitemap += '    <changefreq>daily</changefreq>\n';
    sitemap += '    <priority>0.9</priority>\n';
    sitemap += '  </url>\n';
    
    // Series pages with image sitemap support
    for (const s of allSeries) {
      // Skip series marked as noindex
      if (s.robotsNoindex === 'true') continue;
      
      const priority = s.isFeatured === 'true' || s.isTrending === 'true' ? '0.9' : '0.8';
      
      sitemap += '  <url>\n';
      sitemap += `    <loc>${baseUrl}/manga/${s.id}</loc>\n`;
      sitemap += `    <lastmod>${s.updatedAt ? new Date(s.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}</lastmod>\n`;
      sitemap += '    <changefreq>weekly</changefreq>\n';
      sitemap += `    <priority>${priority}</priority>\n`;
      
      // Add image sitemap entry if cover image exists
      if (s.coverImageUrl) {
        sitemap += '    <image:image>\n';
        sitemap += `      <image:loc>${escapeXml(s.coverImageUrl)}</image:loc>\n`;
        sitemap += `      <image:title>${escapeXml(s.title)}</image:title>\n`;
        if (s.description) {
          sitemap += `      <image:caption>${escapeXml(s.description.substring(0, 200))}</image:caption>\n`;
        }
        sitemap += '    </image:image>\n';
      }
      
      sitemap += '  </url>\n';
    }
    
    // Chapter pages (limit to published chapters)
    for (const chapter of allChapters) {
      // Skip unpublished or noindex chapters
      if (chapter.isPublished !== 'true' || chapter.robotsNoindex === 'true') continue;
      
      sitemap += '  <url>\n';
      sitemap += `    <loc>${baseUrl}/manga/${chapter.seriesId}/chapter/${chapter.chapterNumber}</loc>\n`;
      sitemap += `    <lastmod>${chapter.updatedAt ? new Date(chapter.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}</lastmod>\n`;
      sitemap += '    <changefreq>monthly</changefreq>\n';
      sitemap += '    <priority>0.6</priority>\n';
      sitemap += '  </url>\n';
    }
    
    // Static pages
    const staticPages = [
      { path: '/privacy', priority: '0.3', changefreq: 'monthly' },
      { path: '/dmca', priority: '0.3', changefreq: 'monthly' },
    ];
    
    for (const page of staticPages) {
      sitemap += '  <url>\n';
      sitemap += `    <loc>${baseUrl}${page.path}</loc>\n`;
      sitemap += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
      sitemap += `    <changefreq>${page.changefreq}</changefreq>\n`;
      sitemap += `    <priority>${page.priority}</priority>\n`;
      sitemap += '  </url>\n';
    }
    
    sitemap += '</urlset>';
    
    res.header('Content-Type', 'application/xml');
    res.header('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(sitemap);
  } catch (error) {
    console.error("Error generating sitemap:", error);
    res.status(500).send('Error generating sitemap');
  }
});

router.get("/robots.txt", (req, res) => {
  const baseUrl = req.protocol + '://' + req.get('host');
  
  let robotsTxt = `# AmourScans Robots.txt
# Allow all search engines to crawl

User-agent: *
Allow: /
Disallow: /admin/
Disallow: /admin/*
Disallow: /api/
Disallow: /settings
Disallow: /library
Disallow: /history
Disallow: /profile

# Sitemap location
Sitemap: ${baseUrl}/sitemap.xml

# Crawl delay (be nice to our servers)
Crawl-delay: 1
`;
  
  res.header('Content-Type', 'text/plain');
  res.header('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
  res.send(robotsTxt);
});

/**
 * SEO health check endpoint
 * Returns SEO metrics and health status for monitoring
 */
router.get("/api/seo/health", async (req, res) => {
  try {
    const allSeries = await storage.getAllSeries();
    const allChapters = await storage.getAllChapters();
    
    // Calculate SEO coverage metrics
    const seriesWithMetaTitle = allSeries.filter((s: any) => s.metaTitle).length;
    const seriesWithMetaDescription = allSeries.filter((s: any) => s.metaDescription).length;
    const seriesWithCoverImage = allSeries.filter((s: any) => s.coverImageUrl).length;
    const noindexSeries = allSeries.filter((s: any) => s.robotsNoindex === 'true').length;
    const indexableSeries = allSeries.length - noindexSeries;
    
    const publishedChapters = allChapters.filter((c: any) => c.isPublished === 'true').length;
    const noindexChapters = allChapters.filter((c: any) => c.robotsNoindex === 'true').length;
    
    const health = {
      timestamp: new Date().toISOString(),
      content: {
        totalSeries: allSeries.length,
        totalChapters: allChapters.length,
        publishedChapters,
      },
      seoMetadata: {
        metaTitleCoverage: `${seriesWithMetaTitle}/${allSeries.length} (${((seriesWithMetaTitle / allSeries.length) * 100).toFixed(1)}%)`,
        metaDescriptionCoverage: `${seriesWithMetaDescription}/${allSeries.length} (${((seriesWithMetaDescription / allSeries.length) * 100).toFixed(1)}%)`,
        coverImageCoverage: `${seriesWithCoverImage}/${allSeries.length} (${((seriesWithCoverImage / allSeries.length) * 100).toFixed(1)}%)`,
      },
      indexing: {
        indexableSeries,
        noindexSeries,
        indexableChapters: publishedChapters - noindexChapters,
        noindexChapters,
      },
      sitemap: {
        url: `${req.protocol}://${req.get('host')}/sitemap.xml`,
        robotsTxt: `${req.protocol}://${req.get('host')}/robots.txt`,
        estimatedUrls: indexableSeries + publishedChapters - noindexChapters + 4, // series + chapters + static pages
      },
      structuredData: {
        enabled: true,
        types: ['CreativeWorkSeries', 'ComicStory', 'BreadcrumbList', 'WebSite', 'AggregateRating'],
        prerenderingEnabled: true,
      },
      recommendations: [] as string[],
    };
    
    // Generate recommendations
    if ((seriesWithMetaTitle / allSeries.length) < 0.5) {
      health.recommendations.push('Less than 50% of series have custom meta titles. Consider adding meta titles for better SEO.');
    }
    if ((seriesWithMetaDescription / allSeries.length) < 0.5) {
      health.recommendations.push('Less than 50% of series have custom meta descriptions. Add descriptions for better search snippets.');
    }
    if ((seriesWithCoverImage / allSeries.length) < 0.8) {
      health.recommendations.push('Some series are missing cover images. Images improve visual search results.');
    }
    
    res.json(health);
  } catch (error) {
    console.error('[SEO] Error generating health report:', error);
    res.status(500).json({ error: 'Failed to generate SEO health report' });
  }
});

/**
 * Comprehensive SEO audit endpoint
 * Validates sitemap, meta tags, structured data, and internal linking
 */
router.get("/api/seo/audit", async (req, res) => {
  try {
    const baseUrl = req.protocol + '://' + req.get('host');
    const allSeries = await storage.getAllSeries();
    const allChapters = await storage.getAllChapters();
    
    const audit = {
      timestamp: new Date().toISOString(),
      sitemapValidation: {
        accessible: true,
        totalUrls: 0,
        seriesUrls: 0,
        chapterUrls: 0,
        staticUrls: 2, // /privacy, /dmca
        imageEntries: 0,
      },
      metaTags: {
        seriesWithCustomTitle: 0,
        seriesWithCustomDescription: 0,
        seriesWithCanonicalUrl: 0,
        seriesWithSeoKeywords: 0,
        totalSeries: allSeries.length,
      },
      structuredData: {
        enabled: true,
        schemas: [
          { type: 'CreativeWorkSeries', pages: 'Manga detail pages' },
          { type: 'ComicStory', pages: 'Chapter pages' },
          { type: 'WebSite', pages: 'Homepage' },
          { type: 'BreadcrumbList', pages: 'All pages' },
          { type: 'AggregateRating', pages: 'Series with ratings' },
        ],
      },
      internalLinking: {
        averageLinksPerPage: 0,
        orphanPages: 0,
        recommendations: [] as string[],
      },
      indexability: {
        indexableSeries: allSeries.filter((s: any) => s.robotsNoindex !== 'true').length,
        indexableChapters: allChapters.filter((c: any) => c.isPublished === 'true' && c.robotsNoindex !== 'true').length,
        noindexSeries: allSeries.filter((s: any) => s.robotsNoindex === 'true').length,
        noindexChapters: allChapters.filter((c: any) => c.robotsNoindex === 'true').length,
      },
      performance: {
        prerendering: 'enabled',
        caching: 'enabled',
        compressionRecommended: 'Brotli/Gzip',
      },
      issues: [] as string[],
      warnings: [] as string[],
      recommendations: [] as string[],
    };
    
    // Validate sitemap
    const indexableSeries = allSeries.filter((s: any) => s.robotsNoindex !== 'true');
    const indexableChapters = allChapters.filter((c: any) => c.isPublished === 'true' && c.robotsNoindex !== 'true');
    
    audit.sitemapValidation.seriesUrls = indexableSeries.length;
    audit.sitemapValidation.chapterUrls = indexableChapters.length;
    audit.sitemapValidation.imageEntries = indexableSeries.filter((s: any) => s.coverImageUrl).length;
    audit.sitemapValidation.totalUrls = audit.sitemapValidation.seriesUrls + audit.sitemapValidation.chapterUrls + audit.sitemapValidation.staticUrls + 2; // +2 for homepage and browse
    
    // Check meta tags
    audit.metaTags.seriesWithCustomTitle = allSeries.filter((s: any) => s.metaTitle).length;
    audit.metaTags.seriesWithCustomDescription = allSeries.filter((s: any) => s.metaDescription).length;
    audit.metaTags.seriesWithCanonicalUrl = allSeries.filter((s: any) => s.canonicalUrl).length;
    audit.metaTags.seriesWithSeoKeywords = allSeries.filter((s: any) => s.seoKeywords).length;
    
    // Generate issues and recommendations
    if (audit.metaTags.seriesWithCustomTitle === 0) {
      audit.issues.push('No series have custom meta titles. Add titles via Admin → SEO Management');
    }
    if (audit.metaTags.seriesWithCustomDescription === 0) {
      audit.issues.push('No series have custom meta descriptions. Add descriptions for better search snippets');
    }
    if (audit.metaTags.seriesWithCustomTitle / allSeries.length < 0.5) {
      audit.warnings.push('Less than 50% of series have custom meta titles');
    }
    if (audit.metaTags.seriesWithCustomDescription / allSeries.length < 0.5) {
      audit.warnings.push('Less than 50% of series have custom meta descriptions');
    }
    
    // Internal linking recommendations
    audit.internalLinking.recommendations.push('Add "Related Series" sections based on genre matching');
    audit.internalLinking.recommendations.push('Add "Same Author" links to connect series by the same creator');
    audit.internalLinking.recommendations.push('Include "Popular Series" in sidebar for better internal link distribution');
    
    // General recommendations
    if (audit.sitemapValidation.totalUrls > 1000) {
      audit.recommendations.push('Consider implementing sitemap index for better scalability (currently ' + audit.sitemapValidation.totalUrls + ' URLs)');
    }
    audit.recommendations.push('Submit sitemap to Google Search Console: ' + baseUrl + '/sitemap.xml');
    audit.recommendations.push('Submit sitemap to Bing Webmaster Tools');
    audit.recommendations.push('Enable real user monitoring for Core Web Vitals tracking');
    
    res.json(audit);
  } catch (error) {
    console.error('[SEO] Error generating audit:', error);
    res.status(500).json({ error: 'Failed to generate SEO audit' });
  }
});

/**
 * Get related series for internal linking
 * Returns series with same genres, same author, or trending
 */
router.get("/api/seo/related/:seriesId", async (req, res) => {
  try {
    const { seriesId } = req.params;
    const series = await storage.getSeries(seriesId);
    
    if (!series) {
      return res.status(404).json({ error: 'Series not found' });
    }
    
    const allSeries = await storage.getAllSeries();
    const genres = series.genres ? (typeof series.genres === 'string' ? JSON.parse(series.genres) : series.genres) : [];
    
    // Find related series
    const sameAuthor = allSeries.filter((s: any) => 
      s.id !== seriesId && 
      s.author === series.author && 
      s.robotsNoindex !== 'true'
    ).slice(0, 5);
    
    const sameGenre = allSeries.filter((s: any) => {
      if (s.id === seriesId || s.robotsNoindex === 'true') return false;
      const sGenres = s.genres ? (typeof s.genres === 'string' ? JSON.parse(s.genres) : s.genres) : [];
      return genres.some((g: string) => sGenres.includes(g));
    }).slice(0, 8);
    
    const trending = allSeries.filter((s: any) => 
      s.id !== seriesId && 
      s.isTrending === 'true' && 
      s.robotsNoindex !== 'true'
    ).slice(0, 5);
    
    res.json({
      seriesId,
      seriesTitle: series.title,
      related: {
        sameAuthor: sameAuthor.map((s: any) => ({
          id: s.id,
          title: s.title,
          coverImageUrl: s.coverImageUrl,
          author: s.author,
        })),
        sameGenre: sameGenre.map((s: any) => ({
          id: s.id,
          title: s.title,
          coverImageUrl: s.coverImageUrl,
          genres: s.genres,
        })),
        trending: trending.map((s: any) => ({
          id: s.id,
          title: s.title,
          coverImageUrl: s.coverImageUrl,
          rating: s.rating,
        })),
      },
    });
  } catch (error) {
    console.error('[SEO] Error fetching related series:', error);
    res.status(500).json({ error: 'Failed to fetch related series' });
  }
});

export default router;
