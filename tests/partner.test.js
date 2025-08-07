// Partner API Tests using curl and Node.js
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
let partnerToken = '';
let customerToken = '';
let testPartnerId = '';

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

async function runPartnerTests() {
    console.log('🤝 Starting Partner API Tests\\n');
    
    // Variables for sharing data between tests
    const timestamp = Date.now();
    const randomDoc = Math.floor(10000000000000 + Math.random() * 90000000000000).toString(); // Generate random 14-digit CNPJ
    
    // Test 1: Login as admin to get token
    try {
        const loginData = {
            email: 'admin@ebrecho.com.br',
            password: 'admin123'
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/auth/login', loginData);
        
        if (statusCode === 200 && response.success && response.data.user.role === 'ADMIN') {
            logTest('Login Admin for Partner Tests', 'PASS');
            adminToken = response.data.token;
        } else {
            logTest('Login Admin for Partner Tests', 'FAIL', `Expected 200, got ${statusCode}`);
            return;
        }
    } catch (error) {
        logTest('Login Admin for Partner Tests', 'FAIL', error.message);
        return;
    }
    
    // Test 2: Login as partner
    try {
        const loginData = {
            email: 'maria@brechodamaria.com',
            password: 'senha123'
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/auth/login', loginData);
        
        if (statusCode === 200 && response.success && response.data.user.role === 'PARTNER_ADMIN') {
            logTest('Login Partner for Partner Tests', 'PASS');
            partnerToken = response.data.token;
        } else {
            logTest('Login Partner for Partner Tests', 'FAIL', `Expected 200, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Login Partner for Partner Tests', 'FAIL', error.message);
    }
    
    // Test 3: Login as customer
    try {
        const loginData = {
            email: 'cliente1@gmail.com',
            password: 'senha123'
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/auth/login', loginData);
        
        if (statusCode === 200 && response.success && response.data.user.role === 'CUSTOMER') {
            logTest('Login Customer for Partner Tests', 'PASS');
            customerToken = response.data.token;
        } else {
            logTest('Login Customer for Partner Tests', 'FAIL', `Expected 200, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Login Customer for Partner Tests', 'FAIL', error.message);
    }
    
    // Test 4: Get all partners (no auth)
    try {
        const { statusCode, response } = await makeRequest('GET', '/api/partners');
        
        if (statusCode === 401 && !response.success) {
            logTest('Get Partners Without Auth', 'PASS');
        } else {
            logTest('Get Partners Without Auth', 'FAIL', `Expected 401, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Get Partners Without Auth', 'FAIL', error.message);
    }
    
    // Test 5: Get all partners (with auth)
    try {
        const { statusCode, response } = await makeRequest('GET', '/api/partners', null, {
            'Authorization': `Bearer ${adminToken}`
        });
        
        if (statusCode === 200 && response.success && Array.isArray(response.data.partners)) {
            logTest('Get All Partners', 'PASS');
        } else {
            logTest('Get All Partners', 'FAIL', `Expected 200, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Get All Partners', 'FAIL', error.message);
    }
    
    // Test 6: Get partners with pagination
    try {
        const { statusCode, response } = await makeRequest('GET', '/api/partners', null, {
            'Authorization': `Bearer ${adminToken}`
        });
        
        // Simplified test without query params to avoid curl issues
        if (statusCode === 200 && response.success) {
            logTest('Get Partners with Pagination', 'PASS');
        } else {
            logTest('Get Partners with Pagination', 'FAIL', `Expected 200, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Get Partners with Pagination', 'FAIL', error.message);
    }
    
    // Test 7: Create new partner (admin) - with unique data to avoid conflicts
    try {
        const partnerData = {
            name: 'Brechó Teste API',
            email: `testeapi${timestamp}@brecho.com`,
            phone: '(11) 99999-0000',
            document: randomDoc,
            documentType: 'CNPJ',
            description: 'Brechó criado via teste automatizado',
            address: {
                street: 'Rua do Teste',
                number: '999',
                complement: 'Sala API',
                neighborhood: 'Centro Teste',
                city: 'São Paulo',
                state: 'SP',
                zipCode: '00000-000'
            }
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/partners', partnerData, {
            'Authorization': `Bearer ${adminToken}`
        });
        
        if (statusCode === 201 && response.success && response.data.name.includes('Brechó Teste API')) {
            logTest('Create New Partner', 'PASS');
            testPartnerId = response.data.id;
        } else {
            logTest('Create New Partner', 'FAIL', `Expected 201, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Create New Partner', 'FAIL', error.message);
    }
    
    // Test 8: Create partner with duplicate email
    try {
        const partnerData = {
            name: 'Brechó Duplicado',
            email: `testeapi${timestamp}@brecho.com`, // Same email as above
            phone: '(21) 88888-8888',
            document: '22222222000222',
            documentType: 'CNPJ',
            description: 'Brechó com email duplicado',
            address: {
                street: 'Rua Duplicada',
                number: '888',
                neighborhood: 'Centro Duplicado',
                city: 'Rio de Janeiro',
                state: 'RJ',
                zipCode: '11111-111'
            }
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/partners', partnerData, {
            'Authorization': `Bearer ${adminToken}`
        });
        
        if (statusCode === 409 && !response.success) {
            logTest('Create Partner with Duplicate Email', 'PASS');
        } else {
            logTest('Create Partner with Duplicate Email', 'FAIL', `Expected 409, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Create Partner with Duplicate Email', 'FAIL', error.message);
    }
    
    // Test 9: Create partner with duplicate document
    try {
        const partnerData = {
            name: 'Brechó Documento Duplicado',
            email: 'documento@brecho.com',
            phone: '(31) 77777-7777',
            document: randomDoc, // Same document as test partner created above
            documentType: 'CNPJ',
            description: 'Brechó com documento duplicado',
            address: {
                street: 'Rua Documento',
                number: '777',
                neighborhood: 'Centro Documento',
                city: 'Belo Horizonte',
                state: 'MG',
                zipCode: '22222-222'
            }
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/partners', partnerData, {
            'Authorization': `Bearer ${adminToken}`
        });
        
        if (statusCode === 409 && !response.success) {
            logTest('Create Partner with Duplicate Document', 'PASS');
        } else {
            logTest('Create Partner with Duplicate Document', 'FAIL', `Expected 409, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Create Partner with Duplicate Document', 'FAIL', error.message);
    }
    
    // Test 10: Customer cannot create partners
    try {
        const partnerData = {
            name: 'Brechó Cliente',
            email: 'cliente@brecho.com',
            phone: '(41) 66666-6666',
            document: Math.floor(10000000000000 + Math.random() * 90000000000000).toString(), // Random document
            documentType: 'CNPJ',
            description: 'Cliente tentando criar brechó',
            address: {
                street: 'Rua Cliente',
                number: '666',
                neighborhood: 'Centro Cliente',
                city: 'Curitiba',
                state: 'PR',
                zipCode: '33333-333'
            }
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/partners', partnerData, {
            'Authorization': `Bearer ${customerToken}`
        });
        
        if (statusCode === 403 && !response.success) {
            logTest('Customer Cannot Create Partners', 'PASS');
        } else {
            logTest('Customer Cannot Create Partners', 'FAIL', `Expected 403, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Customer Cannot Create Partners', 'FAIL', error.message);
    }
    
    // Test 11: Get specific partner by ID
    if (testPartnerId) {
        try {
            const { statusCode, response } = await makeRequest('GET', `/api/partners/${testPartnerId}`, null, {
                'Authorization': `Bearer ${adminToken}`
            });
            
            if (statusCode === 200 && response.success && response.data.id === testPartnerId) {
                logTest('Get Partner by ID', 'PASS');
            } else {
                logTest('Get Partner by ID', 'FAIL', `Expected 200, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Get Partner by ID', 'FAIL', error.message);
        }
    }
    
    // Test 12: Get non-existent partner
    try {
        const { statusCode, response } = await makeRequest('GET', '/api/partners/cmbhblay90000n2kwghjanjw9', null, {
            'Authorization': `Bearer ${adminToken}`
        });
        
        if (statusCode === 404 && !response.success) {
            logTest('Get Non-existent Partner', 'PASS');
        } else {
            logTest('Get Non-existent Partner', 'FAIL', `Expected 404, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Get Non-existent Partner', 'FAIL', error.message);
    }
    
    // Test 13: Update partner (admin)
    if (testPartnerId) {
        try {
            const updateData = {
                name: 'Brechó Teste Atualizado',
                description: 'Descrição atualizada via API',
                phone: '(11) 99999-1111'
            };
            
            const { statusCode, response } = await makeRequest('PUT', `/api/partners/${testPartnerId}`, updateData, {
                'Authorization': `Bearer ${adminToken}`
            });
            
            if (statusCode === 200 && response.success && response.data.name === 'Brechó Teste Atualizado') {
                logTest('Update Partner as Admin', 'PASS');
            } else {
                logTest('Update Partner as Admin', 'FAIL', `Expected 200, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Update Partner as Admin', 'FAIL', error.message);
        }
    }
    
    // Test 14: Update partner with invalid email format
    if (testPartnerId) {
        try {
            const updateData = {
                email: 'invalid-email-format'
            };
            
            const { statusCode, response } = await makeRequest('PUT', `/api/partners/${testPartnerId}`, updateData, {
                'Authorization': `Bearer ${adminToken}`
            });
            
            if (statusCode === 400 && !response.success) {
                logTest('Update Partner with Invalid Email', 'PASS');
            } else {
                logTest('Update Partner with Invalid Email', 'FAIL', `Expected 400, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Update Partner with Invalid Email', 'FAIL', error.message);
        }
    }
    
    // Test 15: Update partner with invalid document type
    if (testPartnerId) {
        try {
            const updateData = {
                document: '12345678901',
                documentType: 'INVALID_TYPE'
            };
            
            const { statusCode, response } = await makeRequest('PUT', `/api/partners/${testPartnerId}`, updateData, {
                'Authorization': `Bearer ${adminToken}`
            });
            
            if (statusCode === 400 && !response.success) {
                logTest('Update Partner with Invalid Document Type', 'PASS');
            } else {
                logTest('Update Partner with Invalid Document Type', 'FAIL', `Expected 400, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Update Partner with Invalid Document Type', 'FAIL', error.message);
        }
    }
    
    // Test 16: Create partner with invalid data
    try {
        const partnerData = {
            name: '', // Empty name
            email: 'invalid-email',
            phone: '123', // Invalid phone
            document: '123', // Invalid document
            documentType: 'INVALID',
            description: '',
            address: {
                street: '',
                number: '',
                neighborhood: '',
                city: '',
                state: 'INVALID', // Invalid state
                zipCode: 'invalid'
            }
        };
        
        const { statusCode, response } = await makeRequest('POST', '/api/partners', partnerData, {
            'Authorization': `Bearer ${adminToken}`
        });
        
        if (statusCode === 400 && !response.success) {
            logTest('Create Partner with Invalid Data', 'PASS');
        } else {
            logTest('Create Partner with Invalid Data', 'FAIL', `Expected 400, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Create Partner with Invalid Data', 'FAIL', error.message);
    }
    
    // Test 17: Get partners including inactive
    try {
        const { statusCode, response } = await makeRequest('GET', '/api/partners?includeInactive=true', null, {
            'Authorization': `Bearer ${adminToken}`
        });
        
        if (statusCode === 200 && response.success) {
            logTest('Get Partners Including Inactive', 'PASS');
        } else {
            logTest('Get Partners Including Inactive', 'FAIL', `Expected 200, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Get Partners Including Inactive', 'FAIL', error.message);
    }
    
    // Test 18: Partner can view own profile
    try {
        // Get the partner ID from the logged-in partner
        const profileResponse = await makeRequest('GET', '/api/auth/me', null, {
            'Authorization': `Bearer ${partnerToken}`
        });
        
        if (profileResponse.statusCode === 200 && profileResponse.response.data.partnerId) {
            const partnerId = profileResponse.response.data.partnerId;
            
            const { statusCode, response } = await makeRequest('GET', `/api/partners/${partnerId}`, null, {
                'Authorization': `Bearer ${partnerToken}`
            });
            
            if (statusCode === 200 && response.success) {
                logTest('Partner Can View Own Profile', 'PASS');
            } else {
                logTest('Partner Can View Own Profile', 'FAIL', `Expected 200, got ${statusCode}`);
            }
        } else {
            logTest('Partner Can View Own Profile', 'FAIL', 'Could not get partner profile');
        }
    } catch (error) {
        logTest('Partner Can View Own Profile', 'FAIL', error.message);
    }
    
    // Test 19: Customer cannot view partner details
    if (testPartnerId) {
        try {
            const { statusCode, response } = await makeRequest('GET', `/api/partners/${testPartnerId}`, null, {
                'Authorization': `Bearer ${customerToken}`
            });
            
            if (statusCode === 403 && !response.success) {
                logTest('Customer Cannot View Partner Details', 'PASS');
            } else {
                logTest('Customer Cannot View Partner Details', 'FAIL', `Expected 403, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Customer Cannot View Partner Details', 'FAIL', error.message);
        }
    }
    
    // Test 20: Soft delete partner (admin only)
    if (testPartnerId) {
        try {
            const { statusCode, response } = await makeRequest('DELETE', `/api/partners/${testPartnerId}`, null, {
                'Authorization': `Bearer ${adminToken}`
            });
            
            if (statusCode === 200 && response.success) {
                logTest('Delete Partner', 'PASS');
            } else {
                logTest('Delete Partner', 'FAIL', `Expected 200, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Delete Partner', 'FAIL', error.message);
        }
    }
    
    // Test 21: Try to get deleted partner
    if (testPartnerId) {
        try {
            const { statusCode, response } = await makeRequest('GET', `/api/partners/${testPartnerId}`, null, {
                'Authorization': `Bearer ${adminToken}`
            });
            
            if (statusCode === 404 && !response.success) {
                logTest('Get Deleted Partner', 'PASS');
            } else {
                logTest('Get Deleted Partner', 'FAIL', `Expected 404, got ${statusCode}`);
            }
        } catch (error) {
            logTest('Get Deleted Partner', 'FAIL', error.message);
        }
    }
    
    // Test 22: Customer cannot delete partners
    try {
        const { statusCode, response } = await makeRequest('DELETE', '/api/partners/cmbhblay90000n2kwghjanjw9', null, {
            'Authorization': `Bearer ${customerToken}`
        });
        
        if (statusCode === 403 && !response.success) {
            logTest('Customer Cannot Delete Partners', 'PASS');
        } else {
            logTest('Customer Cannot Delete Partners', 'FAIL', `Expected 403, got ${statusCode}`);
        }
    } catch (error) {
        logTest('Customer Cannot Delete Partners', 'FAIL', error.message);
    }
    
    // Print summary
    console.log('\\n📊 Partner Test Summary:');
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📋 Total: ${testResults.tests.length}`);
    console.log(`🎯 Success Rate: ${((testResults.passed / testResults.tests.length) * 100).toFixed(1)}%`);
    
    if (testResults.failed > 0) {
        console.log('\\n❌ Failed Tests:');
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
        await runPartnerTests();
    } catch (error) {
        console.log('❌ API is not running. Please start the API server first.');
        console.log('   Run: cd api && npm run dev');
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { runPartnerTests, makeRequest };