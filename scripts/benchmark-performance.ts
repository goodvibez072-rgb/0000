#!/usr/bin/env npx tsx
/**
 * Performance Benchmarking Script for MangaVerse
 * Measures API response times, database query performance, and memory usage
 * Run periodically to track performance trends
 */

interface BenchmarkResult {
  test: string;
  iterations: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  p50: number;
  p95: number;
  p99: number;
}

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';
const ITERATIONS = 100; // Number of requests per endpoint

async function measureRequest(url: string): Promise<number> {
  const start = performance.now();
  try {
    const response = await fetch(url);
    await response.text(); // Consume response body
    return performance.now() - start;
  } catch (error) {
    return -1; // Error indicator
  }
}

async function benchmarkEndpoint(
  name: string,
  path: string,
  iterations: number = ITERATIONS
): Promise<BenchmarkResult> {
  const url = `${BASE_URL}${path}`;
  const times: number[] = [];
  
  console.log(`\n📊 Benchmarking: ${name}`);
  console.log(`   URL: ${path}`);
  console.log(`   Iterations: ${iterations}`);
  
  // Warmup
  await measureRequest(url);
  
  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const time = await measureRequest(url);
    if (time > 0) {
      times.push(time);
    }
    
    // Progress indicator every 20%
    if ((i + 1) % Math.floor(iterations / 5) === 0) {
      process.stdout.write('.');
    }
    
    // Small delay to avoid overwhelming server
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  console.log(' Done!');
  
  // Guard against empty array (all requests failed)
  if (times.length === 0) {
    console.error(`  ❌ All ${iterations} requests failed for ${name}`);
    return {
      test: name,
      iterations: 0,
      totalTime: 0,
      avgTime: Infinity,
      minTime: Infinity,
      maxTime: Infinity,
      p50: Infinity,
      p95: Infinity,
      p99: Infinity
    };
  }
  
  // Calculate statistics
  const sorted = times.sort((a, b) => a - b);
  const totalTime = times.reduce((sum, t) => sum + t, 0);
  const avgTime = totalTime / times.length;
  const minTime = sorted[0];
  const maxTime = sorted[sorted.length - 1];
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  
  return {
    test: name,
    iterations: times.length,
    totalTime,
    avgTime,
    minTime,
    maxTime,
    p50,
    p95,
    p99
  };
}

function formatTime(ms: number): string {
  // Handle non-finite values
  if (!isFinite(ms)) {
    return 'N/A';
  }
  
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}μs`;
  } else if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  } else {
    return `${(ms / 1000).toFixed(2)}s`;
  }
}

function getPerformanceGrade(avgTime: number): string {
  // Handle non-finite values
  if (!isFinite(avgTime)) {
    return 'F';
  }
  
  if (avgTime < 10) return 'A+';
  if (avgTime < 50) return 'A';
  if (avgTime < 100) return 'B';
  if (avgTime < 200) return 'C';
  if (avgTime < 500) return 'D';
  return 'F';
}

async function runBenchmarks() {
  console.log('🚀 MangaVerse Performance Benchmark\n');
  console.log('='.repeat(80));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Iterations per endpoint: ${ITERATIONS}`);
  console.log(`Warmup: 1 request per endpoint`);
  console.log('='.repeat(80));
  
  const startTime = Date.now();
  const results: BenchmarkResult[] = [];
  
  // Define endpoints to benchmark
  const endpoints = [
    { name: 'Homepage Sections - Featured', path: '/api/sections/featured' },
    { name: 'Homepage Sections - Trending', path: '/api/sections/trending' },
    { name: 'Homepage Sections - Popular', path: '/api/sections/popular-today' },
    { name: 'Homepage Sections - Latest', path: '/api/sections/latest-updates' },
    { name: 'Homepage Sections - Pinned', path: '/api/sections/pinned' },
    { name: 'Series List', path: '/api/series' },
    { name: 'Languages', path: '/api/languages' },
    { name: 'Currency Packages', path: '/api/currency/packages' },
    { name: 'Subscription Packages', path: '/api/subscriptions/packages' },
    { name: 'Active Flash Sales', path: '/api/flash-sales/active' },
    { name: 'Ad Settings', path: '/api/settings/public/ad-intensity' },
    { name: 'Homepage Ads', path: '/api/ads/placement/homepage' },
    { name: 'Search Results Ads', path: '/api/ads/placement/search_results' },
  ];
  
  // Run benchmarks
  for (const endpoint of endpoints) {
    const result = await benchmarkEndpoint(endpoint.name, endpoint.path);
    results.push(result);
  }
  
  const totalDuration = Date.now() - startTime;
  
  // Display results
  console.log('\n' + '='.repeat(80));
  console.log('\n📈 Benchmark Results:\n');
  
  // Table header
  console.log('┌' + '─'.repeat(40) + '┬' + '─'.repeat(10) + '┬' + '─'.repeat(10) + '┬' + '─'.repeat(10) + '┬' + '─'.repeat(6) + '┐');
  console.log('│ Endpoint'.padEnd(41) + '│ Avg'.padEnd(11) + '│ P95'.padEnd(11) + '│ P99'.padEnd(11) + '│ Grade│');
  console.log('├' + '─'.repeat(40) + '┼' + '─'.repeat(10) + '┼' + '─'.repeat(10) + '┼' + '─'.repeat(10) + '┼' + '─'.repeat(6) + '┤');
  
  results.forEach(result => {
    const name = result.test.substring(0, 39).padEnd(40);
    const avg = formatTime(result.avgTime).padEnd(10);
    const p95 = formatTime(result.p95).padEnd(10);
    const p99 = formatTime(result.p99).padEnd(10);
    const grade = getPerformanceGrade(result.avgTime).padEnd(5);
    console.log(`│ ${name}│ ${avg}│ ${p95}│ ${p99}│ ${grade}│`);
  });
  
  console.log('└' + '─'.repeat(40) + '┴' + '─'.repeat(10) + '┴' + '─'.repeat(10) + '┴' + '─'.repeat(10) + '┴' + '─'.repeat(6) + '┘');
  
  // Summary statistics
  console.log('\n📊 Summary:\n');
  
  // Separate successful and failed endpoints
  const successful = results.filter(r => r.iterations > 0);
  const failed = results.filter(r => r.iterations === 0);
  
  console.log(`  Total Endpoints: ${results.length}`);
  console.log(`  Successful: ${successful.length}`);
  if (failed.length > 0) {
    console.log(`  Failed: ${failed.length} ❌`);
  }
  console.log(`  Total Requests: ${results.reduce((sum, r) => sum + r.iterations, 0)}`);
  console.log(`  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  
  // Declare variables for stats (will be calculated if successful.length > 0)
  let avgOfAvgs = NaN;
  let avgOfP95s = NaN;
  let avgOfP99s = NaN;
  let overallGrade = 'F';
  
  // Calculate stats only on successful endpoints
  if (successful.length > 0) {
    avgOfAvgs = successful.reduce((sum, r) => sum + r.avgTime, 0) / successful.length;
    avgOfP95s = successful.reduce((sum, r) => sum + r.p95, 0) / successful.length;
    avgOfP99s = successful.reduce((sum, r) => sum + r.p99, 0) / successful.length;
    const fastest = successful.reduce((min, r) => r.avgTime < min.avgTime ? r : min);
    const slowest = successful.reduce((max, r) => r.avgTime > max.avgTime ? r : max);
    overallGrade = getPerformanceGrade(avgOfAvgs);
    
    console.log(`  Average (Avg): ${formatTime(avgOfAvgs)}`);
    console.log(`  Average (P95): ${formatTime(avgOfP95s)}`);
    console.log(`  Average (P99): ${formatTime(avgOfP99s)}`);
    console.log(`  Fastest: ${fastest.test} (${formatTime(fastest.avgTime)})`);
    console.log(`  Slowest: ${slowest.test} (${formatTime(slowest.avgTime)})`);
  } else {
    console.log(`  ❌ All endpoints failed - cannot calculate statistics`);
  }
  
  // Performance grades distribution (only successful)
  if (successful.length > 0) {
    const grades = successful.map(r => getPerformanceGrade(r.avgTime));
    const gradeCounts = grades.reduce((acc, grade) => {
      acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  
    console.log('\n📊 Performance Grades:\n');
    Object.entries(gradeCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([grade, count]) => {
        const percentage = ((count / successful.length) * 100).toFixed(1);
        console.log(`  ${grade}: ${count} (${percentage}%)`);
      });
    
    // Overall verdict
    console.log('\n🎯 Overall Performance:\n');
    console.log(`  Overall Grade: ${overallGrade}`);
    
    if (avgOfAvgs < 10) {
      console.log('  Verdict: ⚡ EXCELLENT - Lightning fast! Production-ready.');
    } else if (avgOfAvgs < 50) {
      console.log('  Verdict: ✅ VERY GOOD - Great performance. Production-ready.');
    } else if (avgOfAvgs < 100) {
      console.log('  Verdict: ✅ GOOD - Acceptable performance. Consider optimizations.');
    } else if (avgOfAvgs < 200) {
      console.log('  Verdict: ⚠️  FAIR - Performance could be improved.');
    } else {
      console.log('  Verdict: ❌ POOR - Performance needs improvement.');
    }
  } else {
    console.log('\n🎯 Overall Performance:\n');
    console.log('  ❌ All endpoints failed - cannot provide performance verdict');
  }
  
  // Performance recommendations
  console.log('\n💡 Recommendations:\n');
  
  const slowEndpoints = results.filter(r => r.avgTime > 50);
  if (slowEndpoints.length > 0) {
    console.log('  Endpoints needing optimization:');
    slowEndpoints.forEach(r => {
      console.log(`    - ${r.test}: ${formatTime(r.avgTime)}`);
    });
  } else {
    console.log('  ✅ All endpoints performing well!');
  }
  
  if (avgOfP99s > 200) {
    console.log('  ⚠️  P99 latency is high. Consider:');
    console.log('     - Database query optimization');
    console.log('     - Caching frequently accessed data');
    console.log('     - Connection pooling');
  }
  
  if (avgOfAvgs > 100) {
    console.log('  ⚠️  Average response time is high. Consider:');
    console.log('     - Adding database indexes');
    console.log('     - Implementing response caching');
    console.log('     - Optimizing database queries');
  }
  
  console.log('\n' + '='.repeat(80));
  
  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultFile = `./benchmarks/benchmark_${timestamp}.json`;
  
  try {
    const fs = await import('fs');
    if (!fs.existsSync('./benchmarks')) {
      fs.mkdirSync('./benchmarks', { recursive: true });
    }
    
    fs.writeFileSync(resultFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      baseUrl: BASE_URL,
      iterations: ITERATIONS,
      summary: {
        totalEndpoints: results.length,
        avgOfAvgs,
        avgOfP95s,
        avgOfP99s,
        overallGrade,
        totalDuration
      },
      results
    }, null, 2));
    
    console.log(`\n💾 Results saved to: ${resultFile}`);
  } catch (error) {
    console.log('\n⚠️  Could not save results to file');
  }
}

// Run benchmarks
runBenchmarks().catch(console.error);

export {};
