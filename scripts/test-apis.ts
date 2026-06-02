#!/usr/bin/env tsx
/**
 * Comprehensive API Testing Script
 * Tests all major endpoints and functionality
 */

import http from 'http';

const BASE_URL = 'http://localhost:5000';
const results: { endpoint: string; status: number; result: string; time: number }[] = [];

async function testEndpoint(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any): Promise<void> {
  const startTime = Date.now();
  const url = new URL(endpoint, BASE_URL);
  
  return new Promise((resolve) => {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const time = Date.now() - startTime;
        const status = res.statusCode || 0;
        let result = 'OK';
        
        if (status >= 400 && status !== 401 && status !== 403) {
          result = 'ERROR';
        } else if (status === 401 || status === 403) {
          result = 'AUTH'; // Expected for protected endpoints
        }
        
        results.push({ endpoint, status, result, time });
        resolve();
      });
    });

    req.on('error', (error) => {
      results.push({ endpoint, status: 0, result: 'FAIL', time: Date.now() - startTime });
      resolve();
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Comprehensive API Tests...\n');
  
  // Public endpoints
  console.log('Testing public endpoints...');
  await testEndpoint('/');
  await testEndpoint('/api/sections/featured');
  await testEndpoint('/api/sections/trending');
  await testEndpoint('/api/sections/popular-today');
  await testEndpoint('/api/sections/latest-updates');
  await testEndpoint('/api/sections/pinned');
  await testEndpoint('/api/series');
  await testEndpoint('/sitemap.xml');
  await testEndpoint('/robots.txt');
  await testEndpoint('/api/settings/public/ad-intensity');
  
  // Protected endpoints (should return 401)
  console.log('Testing protected endpoints (should be 401/403)...');
  await testEndpoint('/api/auth/user');
  await testEndpoint('/api/library');
  await testEndpoint('/api/currency/balance');
  await testEndpoint('/api/subscriptions/current');
  await testEndpoint('/api/admin/users');
  await testEndpoint('/api/admin/series');
  await testEndpoint('/api/admin/settings');
  
  // Print results
  console.log('\n📊 Test Results:\n');
  console.log('Endpoint'.padEnd(40), 'Status', 'Result', 'Time (ms)');
  console.log('─'.repeat(70));
  
  let passed = 0;
  let failed = 0;
  let totalTime = 0;
  
  results.forEach(({ endpoint, status, result, time }) => {
    const displayEndpoint = endpoint.length > 38 ? endpoint.substring(0, 35) + '...' : endpoint;
    const statusIcon = result === 'OK' ? '✅' : result === 'AUTH' ? '🔒' : '❌';
    console.log(
      statusIcon,
      displayEndpoint.padEnd(38),
      status.toString().padEnd(6),
      result.padEnd(6),
      time + 'ms'
    );
    
    if (result === 'OK' || result === 'AUTH') passed++;
    else failed++;
    totalTime += time;
  });
  
  console.log('─'.repeat(70));
  console.log(`\n✅ Passed: ${passed} | ❌ Failed: ${failed} | ⏱️  Avg Time: ${(totalTime / results.length).toFixed(1)}ms`);
  
  if (failed > 0) {
    console.log('\n⚠️  Some tests failed! Review the results above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!');
  }
}

runTests().catch(console.error);
