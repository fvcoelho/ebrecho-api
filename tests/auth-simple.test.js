#!/usr/bin/env node

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

const API_BASE = 'http://localhost:3001';

// Colors for terminal output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

let testResults = { passed: 0, failed: 0, total: 0 };

function log(color, message) {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function makeRequest(method, endpoint, data = null, token = null) {
    try {
        let cmd = `curl -s -w "STATUS:%{http_code}" -X ${method} "${API_BASE}${endpoint}"`;
        
        if (token) {
            cmd += ` -H "Authorization: Bearer ${token}"`;
        }
        
        if (data && (method === 'POST' || method === 'PUT')) {
            cmd += ` -H "Content-Type: application/json" -d '${JSON.stringify(data)}'`;
        }
        
        const { stdout } = await execAsync(cmd);
        const statusMatch = stdout.match(/STATUS:(\d+)$/);
        const statusCode = statusMatch ? parseInt(statusMatch[1]) : 0;
        const body = stdout.replace(/STATUS:\d+$/, '').trim();
        
        let response;
        try {
            response = JSON.parse(body);
        } catch (e) {
            response = { raw: body };
        }
        
        return { statusCode, response };
    } catch (error) {
        return { statusCode: 0, response: { error: error.message } };
    }
}

function assert(condition, testName, expected, actual) {
    testResults.total++;
    if (condition) {
        testResults.passed++;
        log('green', `✅ ${testName}`);
    } else {
        testResults.failed++;
        log('red', `❌ ${testName}`);
        log('yellow', `   Expected: ${expected}, Got: ${actual}`);
    }
}

async function runTests() {
    log('blue', '🚀 Starting Authentication API Tests\n');
    
    let tokens = {};
    
    // Test 1: Health Check
    {
        const { statusCode, response } = await makeRequest('GET', '/health');
        assert(statusCode === 200, 'Health Check', '200', statusCode);
    }
    
    // Test 2: Register new customer
    {
        // Generate random email to avoid conflicts
        const randomId = Math.random().toString(36).substring(7);
        const userData = {
            email: `test.${randomId}@example.com`,
            password: 'password123',
            name: `Test Customer ${randomId}`
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/auth/register', userData);
        assert(statusCode === 201 && response.success, 'Register New Customer', '201 + success', `${statusCode} + ${response.success}`);
        
        if (response.data && response.data.token) {
            tokens.newCustomer = response.data.token;
        }
    }
    
    // Test 3: Register duplicate email
    {
        const userData = {
            email: 'admin@ebrecho.com.br', // Already exists in seed
            password: 'password123',
            name: 'Test Duplicate'
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/auth/register', userData);
        assert(statusCode === 409 && !response.success, 'Register Duplicate Email', '409 + fail', `${statusCode} + ${response.success}`);
    }
    
    // Test 4: Register with invalid email
    {
        const userData = {
            email: 'invalid-email',
            password: 'password123',
            name: 'Test User'
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/auth/register', userData);
        assert(statusCode === 400 && !response.success, 'Register Invalid Email', '400 + fail', `${statusCode} + ${response.success}`);
    }
    
    // Test 5: Register with short password
    {
        const userData = {
            email: 'test.short@example.com',
            password: '123',
            name: 'Test User'
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/auth/register', userData);
        assert(statusCode === 400 && !response.success, 'Register Short Password', '400 + fail', `${statusCode} + ${response.success}`);
    }
    
    // Test 6: Login with admin credentials
    {
        const loginData = {
            email: 'admin@ebrecho.com.br',
            password: 'admin123'
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/auth/login', loginData);
        assert(statusCode === 200 && response.success && response.data.user.role === 'ADMIN', 'Login Admin', 'Success + ADMIN role', `${statusCode} + ${response.data?.user?.role || 'undefined'}`);
        
        if (response.data && response.data.token) {
            tokens.admin = response.data.token;
        }
    }
    
    // Test 7: Login with partner credentials
    {
        const loginData = {
            email: 'maria@brechodamaria.com',
            password: 'senha123'
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/auth/login', loginData);
        assert(statusCode === 200 && response.success && response.data.user.role === 'PARTNER_ADMIN', 'Login Partner', 'Success + PARTNER_ADMIN role', `${statusCode} + ${response.data?.user?.role || 'undefined'}`);
        
        if (response.data && response.data.token) {
            tokens.partner = response.data.token;
        }
    }
    
    // Test 8: Login with customer credentials
    {
        const loginData = {
            email: 'cliente1@gmail.com',
            password: 'senha123'
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/auth/login', loginData);
        assert(statusCode === 200 && response.success && response.data.user.role === 'CUSTOMER', 'Login Customer', 'Success + CUSTOMER role', `${statusCode} + ${response.data?.user?.role || 'undefined'}`);
        
        if (response.data && response.data.token) {
            tokens.customer = response.data.token;
        }
    }
    
    // Test 9: Login with wrong password
    {
        const loginData = {
            email: 'admin@ebrecho.com.br',
            password: 'wrongpassword'
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/auth/login', loginData);
        assert(statusCode === 401 && !response.success, 'Login Wrong Password', '401 + fail', `${statusCode} + ${response.success}`);
    }
    
    // Test 10: Login with non-existent user
    {
        const loginData = {
            email: 'nonexistent@example.com',
            password: 'password123'
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/auth/login', loginData);
        assert(statusCode === 401 && !response.success, 'Login Non-existent User', '401 + fail', `${statusCode} + ${response.success}`);
    }
    
    // Test 11: Get profile without token
    {
        const { statusCode, response } = await makeRequest('GET', '/api/auth/me');
        assert(statusCode === 401 && !response.success, 'Get Profile No Token', '401 + fail', `${statusCode} + ${response.success}`);
    }
    
    // Test 12: Get profile with invalid token
    {
        const { statusCode, response } = await makeRequest('GET', '/api/auth/me', null, 'invalid-token');
        assert(statusCode === 401 && !response.success, 'Get Profile Invalid Token', '401 + fail', `${statusCode} + ${response.success}`);
    }
    
    // Test 13: Get admin profile with valid token
    if (tokens.admin) {
        const { statusCode, response } = await makeRequest('GET', '/api/auth/me', null, tokens.admin);
        assert(statusCode === 200 && response.success && response.data.role === 'ADMIN', 'Get Admin Profile', 'Success + ADMIN', `${statusCode} + ${response.data?.role || 'undefined'}`);
    }
    
    // Test 14: Get partner profile with valid token
    if (tokens.partner) {
        const { statusCode, response } = await makeRequest('GET', '/api/auth/me', null, tokens.partner);
        assert(statusCode === 200 && response.success && response.data.role === 'PARTNER_ADMIN', 'Get Partner Profile', 'Success + PARTNER_ADMIN', `${statusCode} + ${response.data?.role || 'undefined'}`);
    }
    
    // Test 15: Get customer profile with valid token
    if (tokens.customer) {
        const { statusCode, response } = await makeRequest('GET', '/api/auth/me', null, tokens.customer);
        assert(statusCode === 200 && response.success && response.data.role === 'CUSTOMER', 'Get Customer Profile', 'Success + CUSTOMER', `${statusCode} + ${response.data?.role || 'undefined'}`);
    }
    
    // Test 16: Update profile name
    if (tokens.customer) {
        const updateData = { name: 'Updated Customer Name' };
        const { statusCode, response } = await makeRequest('PUT', '/api/auth/me', updateData, tokens.customer);
        assert(statusCode === 200 && response.success, 'Update Profile Name', 'Success', `${statusCode} + ${response.success}`);
    }
    
    // Test 17: Update password with correct current password
    if (tokens.newCustomer) {
        const updateData = {
            currentPassword: 'password123',
            newPassword: 'newpassword456'
        };
        const { statusCode, response } = await makeRequest('PUT', '/api/auth/me', updateData, tokens.newCustomer);
        assert(statusCode === 200 && response.success, 'Update Password Valid', 'Success', `${statusCode} + ${response.success}`);
    }
    
    // Test 18: Update password with wrong current password
    if (tokens.admin) {
        const updateData = {
            currentPassword: 'wrongcurrentpassword',
            newPassword: 'newpassword789'
        };
        const { statusCode, response } = await makeRequest('PUT', '/api/auth/me', updateData, tokens.admin);
        assert(statusCode === 400 && !response.success, 'Update Password Invalid', '400 + fail', `${statusCode} + ${response.success}`);
    }
    
    // Test 19: Logout
    if (tokens.admin) {
        const { statusCode, response } = await makeRequest('POST', '/api/auth/logout', null, tokens.admin);
        assert(statusCode === 200 && response.success, 'Logout', 'Success', `${statusCode} + ${response.success}`);
    }
    
    // Test 20: Register partner user (with partnerId)
    {
        // First, let's get a partner ID by checking a partner profile
        if (tokens.partner) {
            const { response: partnerProfile } = await makeRequest('GET', '/api/auth/me', null, tokens.partner);
            const partnerId = partnerProfile.data?.partnerId;
            
            if (partnerId) {
                // Generate random email to avoid conflicts
                const randomId = Math.random().toString(36).substring(7);
                const userData = {
                    email: `partner.employee.${randomId}@example.com`,
                    password: 'password123',
                    name: `Partner Employee ${randomId}`,
                    role: 'PARTNER_USER',
                    partnerId: partnerId
                };
                
                const { statusCode, response } = await makeRequest('POST', '/api/auth/register', userData);
                assert(statusCode === 201 && response.success && response.data.user.role === 'PARTNER_USER', 'Register Partner User', 'Success + PARTNER_USER', `${statusCode} + ${response.data?.user?.role || 'undefined'}`);
            } else {
                // If no partnerId from profile, try to get the actual partner ID from the database
                // The partner admin user should have a partnerId that points to their partner
                log('yellow', '   Note: Partner profile did not return partnerId, skipping test');
            }
        }
    }
    
    // Print summary
    console.log('\n' + '='.repeat(50));
    log('blue', '📊 Test Summary:');
    log('green', `✅ Passed: ${testResults.passed}`);
    log('red', `❌ Failed: ${testResults.failed}`);
    log('yellow', `📋 Total: ${testResults.total}`);
    
    const successRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
    if (successRate >= 90) {
        log('green', `🎯 Success Rate: ${successRate}% - Excellent!`);
    } else if (successRate >= 70) {
        log('yellow', `🎯 Success Rate: ${successRate}% - Good`);
    } else {
        log('red', `🎯 Success Rate: ${successRate}% - Needs improvement`);
    }
    
    return testResults;
}

// Main execution
async function main() {
    try {
        const { statusCode } = await makeRequest('GET', '/health');
        if (statusCode !== 200) {
            throw new Error('API not responding');
        }
        
        await runTests();
        
        if (testResults.failed === 0) {
            log('green', '\n🎉 All tests passed! Authentication API is working correctly.');
            process.exit(0);
        } else {
            log('red', `\n⚠️  ${testResults.failed} test(s) failed. Please check the implementation.`);
            process.exit(1);
        }
    } catch (error) {
        log('red', '❌ API is not running or not responding.');
        log('yellow', '   Run: cd api && npm run dev');
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}