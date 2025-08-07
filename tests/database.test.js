// Database Stats and Health Check API Tests using curl and Node.js
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const API_BASE = 'http://localhost:3001';

// Test results
let testResults = {
    passed: 0,
    failed: 0,
    tests: []
};

function logTest(name, status, message = '') {
    const result = { name, status, message };
    testResults.tests.push(result);
    
    if (status === 'PASS') {
        testResults.passed++;
        console.log(`✅ ${name}`);
    } else {
        testResults.failed++;
        console.log(`❌ ${name}: ${message}`);
    }
}


async function runDatabaseTests() {
    console.log('🚀 Starting Database Stats and Health Check API Tests\n');
    
    // Test 1: Get database stats (should work without auth)
    try {
        const { statusCode, response } = await makeRequest('GET', '/api/database/stats');
        
        if (statusCode === 200 && response.success && response.data) {
            // Verify response structure
            const hasRequiredFields = 
                response.data.database &&
                response.data.totals &&
                response.data.active &&
                response.data.productStatus &&
                response.data.productCondition &&
                response.data.userRoles &&
                response.data.recentActivity &&
                response.data.timestamp;
            
            if (hasRequiredFields) {
                logTest('Get Stats - Public Access', 'PASS');
                
                // Log some stats for verification
                console.log('\n📊 Database Stats:');
                console.log(`   Total Users: ${response.data.totals.users}`);
                console.log(`   Total Partners: ${response.data.totals.partners}`);
                console.log(`   Total Products: ${response.data.totals.products}`);
                console.log(`   Active Users: ${response.data.active.users}`);
                console.log(`   Available Products: ${response.data.active.availableProducts}\n`);
            } else {
                logTest('Get Stats - Public Access', 'FAIL', 'Response missing required fields');
            }
        } else {
            logTest('Get Stats - Public Access', 'FAIL', `Expected 200, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Get Stats - Public Access', 'FAIL', error.message);
    }
    
 
    
    // Print summary
    console.log('\n📊 Test Summary:');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📋 Total: ${testResults.tests.length}`);
    console.log(`🎯 Success Rate: ${((testResults.passed / testResults.tests.length) * 100).toFixed(1)}%`);
    
    if (testResults.failed > 0) {
        console.log('\n❌ Failed Tests:');
        testResults.tests
            .filter(test => test.status === 'FAIL')
            .forEach(test => console.log(`   • ${test.name}: ${test.message}`));
    }
    
    return testResults;
}

async function makeRequest(method, endpoint, data = null, headers = {}) {
    const url = `${API_BASE}${endpoint}`;
    let curlCommand = `curl -s -w "\\n%{http_code}" -X ${method}`;
    
    if (data) {
        curlCommand += ` -H "Content-Type: application/json" -d '${JSON.stringify(data)}'`;
    }
    
    Object.entries(headers).forEach(([key, value]) => {
        curlCommand += ` -H "${key}: ${value}"`;
    });
    
    curlCommand += ` "${url}"`;
    
    try {
        const { stdout } = await execAsync(curlCommand);
        const lines = stdout.trim().split('\n');
        const statusCode = parseInt(lines[lines.length - 1]);
        const responseBody = lines.slice(0, -1).join('\n');
        
        let response;
        try {
            response = JSON.parse(responseBody);
        } catch {
            response = responseBody;
        }
        
        return { statusCode, response };
    } catch (error) {
        throw new Error(`Request failed: ${error.message}`);
    }
}

// Check if API is running and run tests
async function main() {
    try {
        await makeRequest('GET', '/health');
        await runDatabaseTests();
    } catch (error) {
        console.log('❌ API is not running. Please start the API server first.');
        console.log('   Run: cd api && npm run dev');
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { runDatabaseTests, makeRequest };