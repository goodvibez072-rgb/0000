#!/usr/bin/env npx tsx
/**
 * API Endpoint Testing Script for MangaVerse
 * Tests all public API endpoints for availability and response time
 * Run this before deployment or after major changes
 */

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  responseTime: number;
  success: boolean;
  errorMessage?: string;
  responseSize?: number;
}

interface EndpointTest {
  method: string;
  path: string;
  description: string;
  expectedStatus: number;
  requiresAuth?: boolean;
}

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:5000';

const ENDPOINTS: EndpointTest[] = [
  // Public endpoints
  { method: 'GET', path: '/api/settings/public/ad-intensity', description: 'Ad intensity settings', expectedStatus: 200 },
  { method: 'GET', path: '/api/sections/featured', description: 'Featured series', expectedStatus: 200 },
  { method: 'GET', path: '/api/sections/trending', description: 'Trending series', expectedStatus: 200 },
  { method: 'GET', path: '/api/sections/popular-today', description: 'Popular today', expectedStatus: 200 },
  { method: 'GET', path: '/api/sections/latest-updates', description: 'Latest updates', expectedStatus: 200 },
  { method: 'GET', path: '/api/sections/pinned', description: 'Pinned series', expectedStatus: 200 },
  { method: 'GET', path: '/api/series', description: 'All series', expectedStatus: 200 },
  { method: 'GET', path: '/api/languages', description: 'Available languages', expectedStatus: 200 },
  { method: 'GET', path: '/api/currency/packages', description: 'Currency packages', expectedStatus: 200 },
  { method: 'GET', path: '/api/subscriptions/packages', description: 'Subscription packages', expectedStatus: 200 },
  { method: 'GET', path: '/api/flash-sales/active', description: 'Active flash sales', expectedStatus: 200 },
  { method: 'GET', path: '/api/ads/placement/homepage', description: 'Homepage ads', expectedStatus: 200 },
  { method: 'GET', path: '/api/ads/placement/search_results', description: 'Search results ads', expectedStatus: 200 },
  
  // Authentication endpoints (expect 401 when not authenticated)
  { method: 'GET', path: '/api/auth/user', description: 'Current user', expectedStatus: 401, requiresAuth: true },
  { method: 'GET', path: '/api/currency/balance', description: 'Currency balance', expectedStatus: 401, requiresAuth: true },
  { method: 'GET', path: '/api/subscriptions/current', description: 'Current subscription', expectedStatus: 401, requiresAuth: true },
  
  // Admin endpoints (expect 401 or 403 when not authenticated/authorized)
  { method: 'GET', path: '/api/admin/users', description: 'Admin - Users list', expectedStatus: 403, requiresAuth: true },
];

async function testEndpoint(test: EndpointTest): Promise<TestResult> {
  const startTime = Date.now();
  const url = `${BASE_URL}${test.path}`;
  
  try {
    const response = await fetch(url, {
      method: test.method,
      headers: {
        'Accept': 'application/json',
      },
    });
    
    const responseTime = Date.now() - startTime;
    const contentLength = response.headers.get('content-length');
    
    const success = response.status === test.expectedStatus;
    
    return {
      endpoint: test.path,
      method: test.method,
      status: response.status,
      responseTime,
      success,
      responseSize: contentLength ? parseInt(contentLength) : undefined,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    return {
      endpoint: test.path,
      method: test.method,
      status: 0,
      responseTime,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function runTests() {
  console.log('🧪 MangaVerse API Endpoint Testing\n');
  console.log('='.repeat(80));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Total endpoints to test: ${ENDPOINTS.length}\n`);
  
  const results: TestResult[] = [];
  
  // Test endpoints sequentially to avoid overwhelming the server
  for (const test of ENDPOINTS) {
    process.stdout.write(`Testing ${test.method.padEnd(6)} ${test.path}... `);
    
    const result = await testEndpoint(test);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ ${result.status} (${result.responseTime}ms)`);
    } else {
      console.log(`❌ ${result.status} (expected ${test.expectedStatus}) (${result.responseTime}ms)`);
      if (result.errorMessage) {
        console.log(`   Error: ${result.errorMessage}`);
      }
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Test Summary:\n');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  const maxResponseTime = Math.max(...results.map(r => r.responseTime));
  const minResponseTime = Math.min(...results.map(r => r.responseTime));
  
  console.log(`  Total tests:     ${results.length}`);
  console.log(`  Passed:          ${passed} ✅`);
  console.log(`  Failed:          ${failed} ${failed > 0 ? '❌' : ''}`);
  console.log(`  Success rate:    ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log(`  Avg response:    ${avgResponseTime.toFixed(1)}ms`);
  console.log(`  Min response:    ${minResponseTime}ms`);
  console.log(`  Max response:    ${maxResponseTime}ms`);
  
  // Performance analysis
  console.log('\n⚡ Performance Analysis:\n');
  const fast = results.filter(r => r.responseTime < 10).length;
  const medium = results.filter(r => r.responseTime >= 10 && r.responseTime < 100).length;
  const slow = results.filter(r => r.responseTime >= 100).length;
  
  console.log(`  Fast (<10ms):    ${fast} (${((fast / results.length) * 100).toFixed(1)}%)`);
  console.log(`  Medium (10-100ms): ${medium} (${((medium / results.length) * 100).toFixed(1)}%)`);
  console.log(`  Slow (>100ms):   ${slow} (${((slow / results.length) * 100).toFixed(1)}%)`);
  
  // Failed tests details
  if (failed > 0) {
    console.log('\n❌ Failed Tests:\n');
    results.filter(r => !r.success).forEach(r => {
      const test = ENDPOINTS.find(t => t.path === r.endpoint);
      console.log(`  ${r.method} ${r.endpoint}`);
      console.log(`    Expected: ${test?.expectedStatus}, Got: ${r.status}`);
      if (r.errorMessage) {
        console.log(`    Error: ${r.errorMessage}`);
      }
    });
  }
  
  // Top 5 slowest endpoints
  console.log('\n🐌 Top 5 Slowest Endpoints:\n');
  const slowest = [...results]
    .sort((a, b) => b.responseTime - a.responseTime)
    .slice(0, 5);
  
  slowest.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.method} ${r.endpoint} - ${r.responseTime}ms`);
  });
  
  // Top 5 fastest endpoints
  console.log('\n🚀 Top 5 Fastest Endpoints:\n');
  const fastest = [...results]
    .sort((a, b) => a.responseTime - b.responseTime)
    .slice(0, 5);
  
  fastest.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.method} ${r.endpoint} - ${r.responseTime}ms`);
  });
  
  // Overall verdict
  console.log('\n' + '='.repeat(80));
  console.log('\n🎯 Overall Verdict:\n');
  
  if (failed === 0) {
    console.log('  ✅ All tests passed! API is functioning correctly.');
  } else {
    console.log(`  ⚠️  ${failed} test(s) failed. Review the failures above.`);
  }
  
  if (avgResponseTime < 50) {
    console.log('  ⚡ Excellent performance! Average response time < 50ms.');
  } else if (avgResponseTime < 100) {
    console.log('  ✅ Good performance. Average response time < 100ms.');
  } else {
    console.log('  ⚠️  Performance could be improved. Average response time > 100ms.');
  }
  
  console.log('\n' + '='.repeat(80));
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run the tests
runTests().catch((error) => {
  console.error('\n❌ Test execution failed:', error);
  process.exit(1);
});

export {};
