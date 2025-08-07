// Address API Tests using curl and Node.js
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

// Global variables for test data
let adminToken = '';
let testPartnerId = '';
let testAddressId = '';

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

async function runAddressTests() {
    console.log('🏠 Starting Address API Tests\n');
    
    // Test 1: Login as admin to get token
    try {
        const loginData = {
            email: 'admin@ebrecho.com.br',
            password: 'admin123'
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/auth/login', loginData);
        
        if (statusCode === 200 && response.success && response.data.user.role === 'ADMIN') {
            logTest('Login Admin for Address Tests', 'PASS');
            adminToken = response.data.token;
        } else {
            logTest('Login Admin for Address Tests', 'FAIL', `Expected 200, got ${statusCode}`);
            return;
        }
    } catch (error) {
        logTest('Login Admin for Address Tests', 'FAIL', error.message);
        return;
    }
    
    // Test 2: Create test partner for address operations
    try {
        const randomId = Math.random().toString(36).substring(2, 15);
        const partnerData = {
            name: `Brechó Test Address ${randomId}`,
            email: `testaddress${randomId}@brecho.com`,
            phone: '(11) 99999-9999',
            document: `1234567890${randomId.substring(0, 4)}`,
            documentType: 'CNPJ',
            description: 'Partner for address testing',
            address: {
                street: 'Rua das Flores',
                number: '123',
                complement: 'Sala 1',
                neighborhood: 'Centro',
                city: 'São Paulo',
                state: 'SP',
                zipCode: '01234-567'
            }
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/partners', partnerData, {
            'Authorization': `Bearer ${adminToken}`
        });
        
        if (statusCode === 201 && response.success && response.data.address) {
            logTest('Create Test Partner with Address', 'PASS');
            testPartnerId = response.data.id;
            testAddressId = response.data.address.id;
        } else {
            logTest('Create Test Partner with Address', 'FAIL', `Expected 201, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Create Test Partner with Address', 'FAIL', error.message);
    }
    
    // Test 3: Get address by partner ID
    if (testPartnerId) {
        try {
            const { statusCode, response } = await makeRequest('GET', `/api/addresses/partner/${testPartnerId}`, null, {
                'Authorization': `Bearer ${adminToken}`
            });
            
            if (statusCode === 200 && response.success && response.data.partnerId === testPartnerId) {
                logTest('Get Address by Partner ID', 'PASS');
            } else {
                logTest('Get Address by Partner ID', 'FAIL', `Expected 200, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Get Address by Partner ID', 'FAIL', error.message);
        }
    }
    
    // Test 4: Get address by non-existent partner ID
    try {
        const { statusCode, response } = await makeRequest('GET', '/api/addresses/partner/invalidpartnerid', null, {
            'Authorization': `Bearer ${adminToken}`
        });
        
        if (statusCode === 400 && !response.success) {
            logTest('Get Address by Invalid Partner ID', 'PASS');
        } else {
            logTest('Get Address by Invalid Partner ID', 'FAIL', `Expected 400, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Get Address by Invalid Partner ID', 'FAIL', error.message);
    }
    
    // Test 5: Update address by ID
    if (testAddressId) {
        try {
            const updateData = {
                street: 'Rua das Rosas Atualizadas',
                number: '456',
                neighborhood: 'Centro Novo'
            };
            
            const { statusCode, response } = await makeRequest('PUT', `/api/addresses/${testAddressId}`, updateData, {
                'Authorization': `Bearer ${adminToken}`
            });
            
            if (statusCode === 200 && response.success && response.data.street === 'Rua das Rosas Atualizadas') {
                logTest('Update Address by ID', 'PASS');
            } else {
                logTest('Update Address by ID', 'FAIL', `Expected 200, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Update Address by ID', 'FAIL', error.message);
        }
    }
    
    // Test 6: Update address by partner ID
    if (testPartnerId) {
        try {
            const updateData = {
                complement: 'Sala 2 - Atualizada',
                city: 'São Paulo Atualizada'
            };
            
            const { statusCode, response } = await makeRequest('PUT', `/api/addresses/partner/${testPartnerId}`, updateData, {
                'Authorization': `Bearer ${adminToken}`
            });
            
            if (statusCode === 200 && response.success && response.data.complement === 'Sala 2 - Atualizada') {
                logTest('Update Address by Partner ID', 'PASS');
            } else {
                logTest('Update Address by Partner ID', 'FAIL', `Expected 200, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Update Address by Partner ID', 'FAIL', error.message);
        }
    }
    
    // Test 7: Create standalone address for existing partner without address
    try {
        // First create a partner with a temporary address (required by schema)
        const randomId = Math.random().toString(36).substring(2, 15);
        const partnerData = {
            name: `Partner No Address ${randomId}`,
            email: `noaddress${randomId}@brecho.com`,
            phone: '(11) 88888-8888',
            document: `9876543210${randomId.substring(0, 4)}`,
            documentType: 'CNPJ',
            description: 'Partner without initial address',
            address: {
                street: 'Temporary Street',
                number: '1',
                neighborhood: 'Temp',
                city: 'TempCity',
                state: 'SP',
                zipCode: '00000-000'
            }
        };
        
        const partnerResponse = await makeRequest('POST', '/api/partners', partnerData, {
            'Authorization': `Bearer ${adminToken}`
        });
        
        if (partnerResponse.statusCode === 201) {
            const partnerId = partnerResponse.response.data.id;
            const addressId = partnerResponse.response.data.address?.id;
            
            // Delete the initial address
            if (addressId) {
                await makeRequest('DELETE', `/api/addresses/${addressId}`, null, {
                    'Authorization': `Bearer ${adminToken}`
                });
            }
            
            // Now create a new address for this partner
            const addressData = {
                street: 'Avenida Independente',
                number: '789',
                neighborhood: 'Vila Nova',
                city: 'Rio de Janeiro',
                state: 'RJ',
                zipCode: '98765-432',
                partnerId: partnerId
            };
            
            const { statusCode, response } = await makeRequest('POST', '/api/addresses', addressData, {
                'Authorization': `Bearer ${adminToken}`
            });
            
            if (statusCode === 201 && response.success && response.data.partnerId === partnerId) {
                logTest('Create Standalone Address', 'PASS');
            } else {
                logTest('Create Standalone Address', 'FAIL', `Expected 201, got ${statusCode}`);
            }
        } else {
            logTest('Create Standalone Address', 'FAIL', 'Failed to create partner for test');
        }
    } catch (error) {
        logTest('Create Standalone Address', 'FAIL', error.message);
    }
    
    // Test 8: Try to create duplicate address for partner
    if (testPartnerId) {
        try {
            const duplicateAddressData = {
                street: 'Rua Duplicada',
                number: '999',
                neighborhood: 'Duplicado',
                city: 'Duplicada',
                state: 'SP',
                zipCode: '99999-999',
                partnerId: testPartnerId
            };
            
            const { statusCode, response } = await makeRequest('POST', '/api/addresses', duplicateAddressData, {
                'Authorization': `Bearer ${adminToken}`
            });
            
            if (statusCode === 409 && !response.success) {
                logTest('Create Duplicate Address', 'PASS');
            } else {
                logTest('Create Duplicate Address', 'FAIL', `Expected 409, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Create Duplicate Address', 'FAIL', error.message);
        }
    }
    
    // Test 9: Validate address data - invalid CEP format
    if (testPartnerId) {
        try {
            const invalidAddressData = {
                street: 'Rua Inválida',
                number: '123',
                neighborhood: 'Inválido',
                city: 'Inválida',
                state: 'SP',
                zipCode: 'invalid-cep',
                partnerId: testPartnerId
            };
            
            const { statusCode, response } = await makeRequest('POST', '/api/addresses', invalidAddressData, {
                'Authorization': `Bearer ${adminToken}`
            });
            
            if (statusCode === 400 && !response.success) {
                logTest('Validate Invalid CEP Format', 'PASS');
            } else {
                logTest('Validate Invalid CEP Format', 'FAIL', `Expected 400, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Validate Invalid CEP Format', 'FAIL', error.message);
        }
    }
    
    // Test 10: Validate address data - invalid state format
    if (testAddressId) {
        try {
            const invalidAddressData = {
                street: 'Rua Estado Inválido',
                number: '123',
                neighborhood: 'Estado Inválido',
                city: 'Cidade',
                state: 'INVALID',
                zipCode: '12345-678',
                partnerId: testPartnerId
            };
            
            const { statusCode, response } = await makeRequest('PUT', `/api/addresses/${testAddressId}`, invalidAddressData, {
                'Authorization': `Bearer ${adminToken}`
            });
            
            if (statusCode === 400 && !response.success) {
                logTest('Validate Invalid State Format', 'PASS');
            } else {
                logTest('Validate Invalid State Format', 'FAIL', `Expected 400, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Validate Invalid State Format', 'FAIL', error.message);
        }
    } else {
        logTest('Validate Invalid State Format', 'FAIL', 'No address ID available for test');
    }
    
    // Test 11: Update non-existent address
    try {
        const updateData = {
            street: 'Rua Inexistente'
        };
        
        const { statusCode, response } = await makeRequest('PUT', '/api/addresses/nonexistentid123', updateData, {
            'Authorization': `Bearer ${adminToken}`
        });
        
        if (statusCode === 400 && !response.success) {
            logTest('Update Non-existent Address', 'PASS');
        } else {
            logTest('Update Non-existent Address', 'FAIL', `Expected 400, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Update Non-existent Address', 'FAIL', error.message);
    }
    
    // Test 12: Access without authentication
    try {
        const { statusCode, response } = await makeRequest('GET', `/api/addresses/partner/${testPartnerId}`);
        
        if (statusCode === 401 && !response.success) {
            logTest('Access Without Authentication', 'PASS');
        } else {
            logTest('Access Without Authentication', 'FAIL', `Expected 401, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Access Without Authentication', 'FAIL', error.message);
    }
    
    // Test 13: Delete address
    if (testAddressId) {
        try {
            const { statusCode, response } = await makeRequest('DELETE', `/api/addresses/${testAddressId}`, null, {
                'Authorization': `Bearer ${adminToken}`
            });
            
            if (statusCode === 200 && response.success) {
                logTest('Delete Address', 'PASS');
            } else {
                logTest('Delete Address', 'FAIL', `Expected 200, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Delete Address', 'FAIL', error.message);
        }
    }
    
    // Test 14: Try to get deleted address
    if (testAddressId) {
        try {
            const { statusCode, response } = await makeRequest('GET', `/api/addresses/partner/${testPartnerId}`, null, {
                'Authorization': `Bearer ${adminToken}`
            });
            
            if (statusCode === 404 && !response.success) {
                logTest('Get Deleted Address', 'PASS');
            } else {
                logTest('Get Deleted Address', 'FAIL', `Expected 404, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Get Deleted Address', 'FAIL', error.message);
        }
    }
    
    // Print summary
    console.log('\n📊 Address Test Summary:');
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
        await runAddressTests();
    } catch (error) {
        console.log('❌ API is not running. Please start the API server first.');
        console.log('   Run: cd api && npm run dev');
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { runAddressTests, makeRequest };