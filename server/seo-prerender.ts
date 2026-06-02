import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

// Comprehensive list of crawler user agents
const CRAWLER_USER_AGENTS = [
  'googlebot',
  'bingbot',
  'slurp',          // Yahoo
  'duckduckbot',
  'baiduspider',
  'yandexbot',
  'sogou',
  'exabot',
  'facebot',        // Facebook
  'ia_archiver',    // Alexa
  'twitterbot',
  'linkedinbot',
  'whatsapp',
  'telegram',
  'slackbot',
  'discordbot',
  'pinterestbot',
  'redditbot',
  'applebot',
  'semrushbot',
  'ahrefsbot',
  'mj12bot',        // Majestic
  'screaming frog',
  'lighthouse',
];

/**
 * Detects if the user agent is a search engine crawler or social media bot
 */
function isCrawler(userAgent: string): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_USER_AGENTS.some(bot => ua.includes(bot));
}

/**
 * Escapes HTML to prevent XSS in server-rendered content
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Generates comprehensive JSON-LD structured data for manga series
 * Using CreativeWorkSeries for better semantic accuracy
 */
function generateSeriesStructuredData(series: any, baseUrl: string, chaptersCount: number) {
  const genresArray = series.genres ? (Array.isArray(series.genres) ? series.genres : JSON.parse(series.genres)) : [];
  
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWorkSeries",
    "name": series.title,
    "url": `${baseUrl}/manga/${series.id}`,
    "image": series.coverImageUrl || `${baseUrl}/placeholder-manga.png`,
    "description": series.description || `Read ${series.title} online`,
    "author": {
      "@type": "Person",
      "name": series.author || "Unknown"
    },
    "creator": {
      "@type": "Person",
      "name": series.artist || series.author || "Unknown"
    },
    "genre": genresArray,
    "inLanguage": "en",
    "workExample": {
      "@type": "Book",
      "bookFormat": "GraphicNovel",
      "numberOfPages": chaptersCount
    },
    "aggregateRating": series.rating ? {
      "@type": "AggregateRating",
      "ratingValue": series.rating,
      "bestRating": "5",
      "worstRating": "1",
      "ratingCount": 100
    } : undefined,
    "publisher": {
      "@type": "Organization",
      "name": "AmourScans"
    },
    "datePublished": series.createdAt,
    "dateModified": series.updatedAt,
    "keywords": series.seoKeywords || genresArray.join(', ')
  };
}

/**
 * Generates JSON-LD structured data for a chapter (ComicStory)
 */
function generateChapterStructuredData(chapter: any, series: any, baseUrl: string) {
  // Ensure image URLs are absolute
  let imageUrl = chapter.coverImageUrl || series.coverImageUrl;
  if (imageUrl && !imageUrl.startsWith('http')) {
    imageUrl = `${baseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
  }
  
  return {
    "@context": "https://schema.org",
    "@type": "ComicStory",
    "name": `${series.title} - Chapter ${chapter.chapterNumber}${chapter.title ? ': ' + chapter.title : ''}`,
    "url": `${baseUrl}/manga/${series.id}/chapter/${chapter.chapterNumber}`,
    "headline": chapter.title || `Chapter ${chapter.chapterNumber}`,
    "isPartOf": {
      "@type": "CreativeWorkSeries",
      "name": series.title,
      "url": `${baseUrl}/manga/${series.id}`
    },
    "author": {
      "@type": "Person",
      "name": series.author || "Unknown"
    },
    "artist": {
      "@type": "Person",
      "name": series.artist || series.author || "Unknown"
    },
    "publisher": {
      "@type": "Organization",
      "name": "AmourScans"
    },
    "position": chapter.chapterNumber,
    "pageStart": "1",
    "pageEnd": chapter.totalPages || "Unknown",
    "image": imageUrl || `${baseUrl}/placeholder-cover.png`,
    "datePublished": chapter.createdAt,
    "dateModified": chapter.updatedAt,
    "inLanguage": "en"
  };
}

/**
 * Generates BreadcrumbList structured data
 */
function generateBreadcrumbs(items: Array<{ name: string; url: string }>, baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": `${baseUrl}${item.url}`
    }))
  };
}

/**
 * Generates prerendered HTML for manga detail page
 */
async function prerenderMangaPage(seriesId: string, baseUrl: string): Promise<string | null> {
  try {
    const manga = await storage.getSeries(seriesId);
    if (!manga) return null;

    const chapters = await storage.getChaptersBySeriesId(seriesId);
    const genresArray = manga.genres ? (Array.isArray(manga.genres) ? manga.genres : JSON.parse(manga.genres)) : [];
    
    // Use custom SEO metadata if available
    const metaTitle = manga.metaTitle || `${manga.title} - Read Online`;
    const metaDescription = manga.metaDescription || manga.description || `Read ${manga.title} - ${manga.type} ${manga.status} with ${chapters.length} chapters`;
    const keywords = manga.seoKeywords || `${manga.title}, ${manga.type}, ${genresArray.join(', ')}, read ${manga.title} online`;
    const canonicalUrl = manga.canonicalUrl || `${baseUrl}/manga/${manga.id}`;
    const robotsMeta = manga.robotsNoindex === 'true' ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';

    // Generate structured data
    const seriesStructuredData = generateSeriesStructuredData(manga, baseUrl, chapters.length);
    const breadcrumbsData = generateBreadcrumbs([
      { name: 'Home', url: '/' },
      { name: 'Browse', url: '/browse' },
      { name: manga.title, url: `/manga/${manga.id}` }
    ], baseUrl);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
  <title>${escapeHtml(metaTitle)} | AmourScans</title>
  
  <!-- SEO Meta Tags -->
  <meta name="description" content="${escapeHtml(metaDescription)}" />
  <meta name="keywords" content="${escapeHtml(keywords)}" />
  <meta name="author" content="${escapeHtml(manga.author || 'Unknown')}" />
  <meta name="robots" content="${robotsMeta}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  
  <!-- Open Graph -->
  <meta property="og:type" content="book" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:title" content="${escapeHtml(metaTitle)}" />
  <meta property="og:description" content="${escapeHtml(metaDescription)}" />
  <meta property="og:image" content="${escapeHtml(manga.coverImageUrl || '')}" />
  <meta property="og:site_name" content="AmourScans" />
  <meta property="book:author" content="${escapeHtml(manga.author || 'Unknown')}" />
  <meta property="book:release_date" content="${manga.createdAt}" />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(metaTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(metaDescription)}" />
  <meta name="twitter:image" content="${escapeHtml(manga.coverImageUrl || '')}" />
  
  <!-- Structured Data -->
  <script type="application/ld+json">${JSON.stringify(seriesStructuredData)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbsData)}</script>
</head>
<body>
  <div id="root">
    <main>
      <article itemscope itemtype="https://schema.org/CreativeWorkSeries">
        <h1 itemprop="name">${escapeHtml(manga.title)}</h1>
        ${manga.coverImageUrl ? `<img itemprop="image" src="${escapeHtml(manga.coverImageUrl)}" alt="${escapeHtml(manga.title)} cover" width="300" height="450" loading="eager" />` : ''}
        <p itemprop="description">${escapeHtml(manga.description || '')}</p>
        <div>
          <span>Author: <span itemprop="author" itemscope itemtype="https://schema.org/Person"><span itemprop="name">${escapeHtml(manga.author || 'Unknown')}</span></span></span>
          <span>Type: ${escapeHtml(manga.type)}</span>
          <span>Status: ${escapeHtml(manga.status)}</span>
          ${manga.rating ? `<span itemprop="aggregateRating" itemscope itemtype="https://schema.org/AggregateRating">
            Rating: <span itemprop="ratingValue">${escapeHtml(manga.rating)}</span>/5 (<span itemprop="ratingCount">100</span> ratings)
          </span>` : ''}
        </div>
        <h2>Chapters (${chapters.length})</h2>
        <ul>
          ${chapters.map((ch: any) => `<li><a href="${baseUrl}/manga/${manga.id}/chapter/${escapeHtml(ch.chapterNumber)}">Chapter ${escapeHtml(ch.chapterNumber)}${ch.title ? ': ' + escapeHtml(ch.title) : ''}</a></li>`).join('\n          ')}
        </ul>
      </article>
    </main>
  </div>
</body>
</html>`;
  } catch (error) {
    console.error('[SEO] Error prerendering manga page:', error);
    return null;
  }
}

/**
 * Generates prerendered HTML for homepage
 */
async function prerenderHomepage(baseUrl: string): Promise<string> {
  const featured = await storage.getSeriesBySection('featured');
  const trending = await storage.getSeriesBySection('trending');
  
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "AmourScans",
    "url": baseUrl,
    "description": "Discover and read thousands of manga and manhwa series online. Your destination for romance comics.",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${baseUrl}/search?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
  <title>AmourScans - Find Your Love Story</title>
  <meta name="description" content="Find your love story - explore romantic manga, manhwa, and manhua with beautiful artwork and heartwarming stories. Your destination for romance comics." />
  <meta name="keywords" content="manga, manhwa, manhua, webtoon, comics, read manga online, manga reader, manhwa reader" />
  <meta name="robots" content="index, follow, max-image-preview:large" />
  <link rel="canonical" href="${baseUrl}/" />
  
  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${baseUrl}/" />
  <meta property="og:title" content="AmourScans - Find Your Love Story" />
  <meta property="og:description" content="Find your love story - explore romantic manga, manhwa, and manhua with beautiful artwork and heartwarming stories." />
  <meta property="og:site_name" content="AmourScans" />
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="AmourScans - Find Your Love Story" />
  <meta name="twitter:description" content="Find your love story - explore romantic manga, manhwa, and manhua with beautiful artwork and heartwarming stories." />
  
  <!-- Structured Data -->
  <script type="application/ld+json">${JSON.stringify(structuredData)}</script>
</head>
<body>
  <div id="root">
    <main>
      <h1>AmourScans - Find Your Love Story</h1>
      <section>
        <h2>Featured Series</h2>
        <ul>
          ${featured.slice(0, 10).map((s: any) => `<li><a href="${baseUrl}/manga/${s.id}">${escapeHtml(s.title)}</a></li>`).join('\n          ')}
        </ul>
      </section>
      <section>
        <h2>Trending Now</h2>
        <ul>
          ${trending.slice(0, 10).map((s: any) => `<li><a href="${baseUrl}/manga/${s.id}">${escapeHtml(s.title)}</a></li>`).join('\n          ')}
        </ul>
      </section>
    </main>
  </div>
</body>
</html>`;
}

/**
 * Middleware to serve prerendered HTML to crawlers
 */
export async function prerenderMiddleware(req: Request, res: Response, next: NextFunction) {
  const userAgent = req.headers['user-agent'] || '';
  
  // Only prerender for crawlers
  if (!isCrawler(userAgent)) {
    return next();
  }

  const baseUrl = req.protocol + '://' + req.get('host');
  
  try {
    // Homepage
    if (req.path === '/' || req.path === '') {
      const html = await prerenderHomepage(baseUrl);
      return res.setHeader('Content-Type', 'text/html').send(html);
    }
    
    // Manga detail page: /manga/:id
    const mangaMatch = req.path.match(/^\/manga\/([^\/]+)$/);
    if (mangaMatch) {
      const seriesId = mangaMatch[1];
      const html = await prerenderMangaPage(seriesId, baseUrl);
      if (html) {
        return res.setHeader('Content-Type', 'text/html').send(html);
      }
    }
    
    // Chapter reader page: /manga/:seriesId/chapter/:chapterNum
    const chapterMatch = req.path.match(/^\/manga\/([^\/]+)\/chapter\/([^\/]+)$/);
    if (chapterMatch) {
      const [, seriesId, chapterNum] = chapterMatch;
      const manga = await storage.getSeries(seriesId);
      if (manga) {
        const chapters = await storage.getChaptersBySeriesId(seriesId);
        const chapter = chapters.find((ch: any) => ch.chapterNumber === chapterNum);
        if (chapter) {
          const chapterStructuredData = generateChapterStructuredData(chapter, manga, baseUrl);
          const breadcrumbsData = generateBreadcrumbs([
            { name: 'Home', url: '/' },
            { name: 'Browse', url: '/browse' },
            { name: manga.title, url: `/manga/${manga.id}` },
            { name: `Chapter ${chapter.chapterNumber}`, url: `/manga/${manga.id}/chapter/${chapter.chapterNumber}` }
          ], baseUrl);
          
          const metaTitle = chapter.metaTitle || `${manga.title} - Chapter ${chapter.chapterNumber}${chapter.title ? ': ' + chapter.title : ''}`;
          const metaDescription = chapter.metaDescription || `Read ${manga.title} Chapter ${chapter.chapterNumber} online. ${chapter.title || ''}`;
          const canonicalUrl = chapter.canonicalUrl || `${baseUrl}/manga/${manga.id}/chapter/${chapter.chapterNumber}`;
          const robotsMeta = chapter.robotsNoindex === 'true' ? 'noindex, nofollow' : 'index, follow, max-image-preview:large';
          
          const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />
  <title>${escapeHtml(metaTitle)} | AmourScans</title>
  <meta name="description" content="${escapeHtml(metaDescription)}" />
  <meta name="robots" content="${robotsMeta}" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="${escapeHtml(metaTitle)}" />
  <meta property="og:description" content="${escapeHtml(metaDescription)}" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:image" content="${escapeHtml(chapter.coverImageUrl || manga.coverImageUrl || '')}" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify(chapterStructuredData)}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumbsData)}</script>
</head>
<body>
  <div id="root">
    <article itemscope itemtype="https://schema.org/ComicStory">
      <h1 itemprop="headline">${escapeHtml(metaTitle)}</h1>
      <p>Read ${escapeHtml(manga.title)} - Chapter ${escapeHtml(chapter.chapterNumber)} online</p>
      <nav>
        <a href="${baseUrl}/manga/${manga.id}">← Back to ${escapeHtml(manga.title)}</a>
      </nav>
    </article>
  </div>
</body>
</html>`;
          return res.setHeader('Content-Type', 'text/html').send(html);
        }
      }
    }
    
    // Browse page
    if (req.path === '/browse') {
      const allSeries = await storage.getAllSeries();
      const breadcrumbsData = generateBreadcrumbs([
        { name: 'Home', url: '/' },
        { name: 'Browse', url: '/browse' }
      ], baseUrl);
      
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Browse Manga & Manhwa | AmourScans</title>
  <meta name="description" content="Browse our complete collection of manga and manhwa series. Find your next read!" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${baseUrl}/browse" />
  <script type="application/ld+json">${JSON.stringify(breadcrumbsData)}</script>
</head>
<body>
  <div id="root">
    <main>
      <h1>Browse All Series</h1>
      <ul>
        ${allSeries.slice(0, 50).map(s => `<li><a href="${baseUrl}/manga/${s.id}">${escapeHtml(s.title)}</a></li>`).join('\n        ')}
      </ul>
    </main>
  </div>
</body>
</html>`;
      return res.setHeader('Content-Type', 'text/html').send(html);
    }
    
    // For other pages, let the client handle it
    next();
  } catch (error) {
    console.error('[SEO] Prerender error:', error);
    next();
  }
}
