// Basic Auth API Tests using curl and Node.js
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

async function makeRequest(method, endpoint, data = null, headers = {}) {
    try {
        let curlCmd = `curl -s -w "\n%{http_code}" -X ${method} ${API_BASE}${endpoint}`;
        
        // Add headers
        Object.keys(headers).forEach(key => {
            curlCmd += ` -H "${key}: ${headers[key]}"`;
        });
        
        // Add data for POST/PUT requests
        if (data && (method === 'POST' || method === 'PUT')) {
            curlCmd += ` -H "Content-Type: application/json" -d '${JSON.stringify(data)}'`;
        }
        
        const { stdout } = await execAsync(curlCmd);
        const lines = stdout.trim().split('\n');
        const statusCode = parseInt(lines[lines.length - 1]);
        const responseBody = lines.slice(0, -1).join('\n');
        
        let response;
        try {
            response = JSON.parse(responseBody);
        } catch (e) {
            response = responseBody;
        }
        
        return { statusCode, response };
    } catch (error) {
        throw new Error(`Request failed: ${error.message}`);
    }
}

async function runAuthTests() {
    console.log('🚀 Starting Authentication API Tests\n');
    
    // Test 1: Health Check
    try {
        const { statusCode, response } = await makeRequest('GET', '/health');
        if (statusCode === 200 && response.status === 'ok') {
            logTest('Health Check', 'PASS');
        } else {
            logTest('Health Check', 'FAIL', `Expected 200, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Health Check', 'FAIL', error.message);
    }
    
    // Test 2: Register new customer
    try {
        const randomId = Math.random().toString(36).substring(2, 15);
        const userData = {
            email: `test.customer.${randomId}@example.com`,
            password: 'password123',
            name: `Test Customer ${randomId}`
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/auth/register', userData);
        
        if (statusCode === 201 && response.success && response.data.user.role === 'CUSTOMER') {
            logTest('Register Customer', 'PASS');
            global.customerToken = response.data.token;
            global.customerEmail = userData.email;
            global.customerPassword = userData.password;
        } else {
            logTest('Register Customer', 'FAIL', `Expected 201, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Register Customer', 'FAIL', error.message);
    }
    
    // Test 3: Register duplicate email (should fail)
    try {
        const userData = {
            email: global.customerEmail || 'admin@ebrecho.com.br', // Use existing email from previous test or admin email
            password: 'password123',
            name: 'Test Customer 2'
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/auth/register', userData);
        
        if (statusCode === 409 && !response.success) {
            logTest('Register Duplicate Email', 'PASS');
        } else {
            logTest('Register Duplicate Email', 'FAIL', `Expected 409, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Register Duplicate Email', 'FAIL', error.message);
    }
    
    // Test 4: Register with invalid data
    try {
        const userData = {
            email: 'invalid-email',
            password: '123',
            name: ''
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/auth/register', userData);
        
        if (statusCode === 400 && !response.success) {
            logTest('Register Invalid Data', 'PASS');
        } else {
            logTest('Register Invalid Data', 'FAIL', `Expected 400, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Register Invalid Data', 'FAIL', error.message);
    }
    
    // Test 5: Login with admin credentials
    try {
        const loginData = {
            email: 'admin@ebrecho.com.br',
            password: 'admin123'
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/auth/login', loginData);
        
        if (statusCode === 200 && response.success && response.data.user.role === 'ADMIN') {
            logTest('Login Admin', 'PASS');
            global.adminToken = response.data.token;
        } else {
            logTest('Login Admin', 'FAIL', `Expected 200, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Login Admin', 'FAIL', error.message);
    }
    
    // Test 6: Login with partner credentials
    try {
        const loginData = {
            email: 'maria@brechodamaria.com',
            password: 'senha123'
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/auth/login', loginData);
        
        if (statusCode === 200 && response.success && response.data.user.role === 'PARTNER_ADMIN') {
            logTest('Login Partner', 'PASS');
            global.partnerToken = response.data.token;
        } else {
            logTest('Login Partner', 'FAIL', `Expected 200, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Login Partner', 'FAIL', error.message);
    }
    
    // Test 7: Login with customer credentials
    if (global.customerEmail && global.customerPassword) {
        try {
            const loginData = {
                email: global.customerEmail,
                password: global.customerPassword
            };
            
            const { statusCode, response } = await makeRequest('POST', '/api/auth/login', loginData);
            
            if (statusCode === 200 && response.success && response.data.user.role === 'CUSTOMER') {
                logTest('Login Customer', 'PASS');
                global.customerToken2 = response.data.token;
            } else {
                logTest('Login Customer', 'FAIL', `Expected 200, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Login Customer', 'FAIL', error.message);
        }
    } else {
        logTest('Login Customer', 'FAIL', 'No customer credentials available from registration');
    }
    
    // Test 8: Login with invalid credentials
    try {
        const loginData = {
            email: 'admin@ebrecho.com.br',
            password: 'wrongpassword'
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/auth/login', loginData);
        
        if (statusCode === 401 && !response.success) {
            logTest('Login Invalid Credentials', 'PASS');
        } else {
            logTest('Login Invalid Credentials', 'FAIL', `Expected 401, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Login Invalid Credentials', 'FAIL', error.message);
    }
    
    // Test 9: Get profile without token
    try {
        const { statusCode, response } = await makeRequest('GET', '/api/auth/me');
        
        if (statusCode === 401 && !response.success) {
            logTest('Get Profile No Token', 'PASS');
        } else {
            logTest('Get Profile No Token', 'FAIL', `Expected 401, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Get Profile No Token', 'FAIL', error.message);
    }
    
    // Test 10: Get profile with valid token (admin)
    if (global.adminToken) {
        try {
            const { statusCode, response } = await makeRequest('GET', '/api/auth/me', null, {
                'Authorization': `Bearer ${global.adminToken}`
            });
            
            if (statusCode === 200 && response.success && response.data.role === 'ADMIN') {
                logTest('Get Admin Profile', 'PASS');
            } else {
                logTest('Get Admin Profile', 'FAIL', `Expected 200, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Get Admin Profile', 'FAIL', error.message);
        }
    }
    
    // Test 11: Get profile with valid token (partner)
    if (global.partnerToken) {
        try {
            const { statusCode, response } = await makeRequest('GET', '/api/auth/me', null, {
                'Authorization': `Bearer ${global.partnerToken}`
            });
            
            if (statusCode === 200 && response.success && response.data.role === 'PARTNER_ADMIN') {
                logTest('Get Partner Profile', 'PASS');
            } else {
                logTest('Get Partner Profile', 'FAIL', `Expected 200, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Get Partner Profile', 'FAIL', error.message);
        }
    }
    
    // Test 12: Get profile with invalid token
    try {
        const { statusCode, response } = await makeRequest('GET', '/api/auth/me', null, {
            'Authorization': 'Bearer invalid-token'
        });
        
        if (statusCode === 401 && !response.success) {
            logTest('Get Profile Invalid Token', 'PASS');
        } else {
            logTest('Get Profile Invalid Token', 'FAIL', `Expected 401, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Get Profile Invalid Token', 'FAIL', error.message);
    }
    
    // Test 13: Update profile with valid token
    if (global.customerToken2) {
        try {
            const updateData = {
                name: 'Updated Customer Name'
            };
            
            const { statusCode, response } = await makeRequest('PUT', '/api/auth/me', updateData, {
                'Authorization': `Bearer ${global.customerToken2}`
            });
            
            if (statusCode === 200 && response.success && response.data.name === 'Updated Customer Name') {
                logTest('Update Profile', 'PASS');
            } else {
                logTest('Update Profile', 'FAIL', `Expected 200, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Update Profile', 'FAIL', error.message);
        }
    }
    
    // Test 14: Update password with correct current password
    if (global.customerToken2 && global.customerPassword) {
        try {
            const updateData = {
                currentPassword: global.customerPassword,
                newPassword: 'newpassword123'
            };
            
            const { statusCode, response } = await makeRequest('PUT', '/api/auth/me', updateData, {
                'Authorization': `Bearer ${global.customerToken2}`
            });
            
            if (statusCode === 200 && response.success) {
                logTest('Update Password Valid', 'PASS');
            } else {
                logTest('Update Password Valid', 'FAIL', `Expected 200, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Update Password Valid', 'FAIL', error.message);
        }
    }
    
    // Test 15: Update password with wrong current password
    if (global.adminToken) {
        try {
            const updateData = {
                currentPassword: 'wrongpassword',
                newPassword: 'newpassword123'
            };
            
            const { statusCode, response } = await makeRequest('PUT', '/api/auth/me', updateData, {
                'Authorization': `Bearer ${global.adminToken}`
            });
            
            if (statusCode === 400 && !response.success) {
                logTest('Update Password Invalid', 'PASS');
            } else {
                logTest('Update Password Invalid', 'FAIL', `Expected 400, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Update Password Invalid', 'FAIL', error.message);
        }
    }
    
    // Test 16: Logout
    if (global.customerToken) {
        try {
            const { statusCode, response } = await makeRequest('POST', '/api/auth/logout', null, {
                'Authorization': `Bearer ${global.customerToken}`
            });
            
            if (statusCode === 200 && response.success) {
                logTest('Logout', 'PASS');
            } else {
                logTest('Logout', 'FAIL', `Expected 200, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Logout', 'FAIL', error.message);
        }
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

// Check if API is running and run tests
async function main() {
    try {
        await makeRequest('GET', '/health');
        await runAuthTests();
    } catch (error) {
        console.log('❌ API is not running. Please start the API server first.');
        console.log('   Run: cd api && npm run dev');
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { runAuthTests, makeRequest };