// Product API Tests using curl and Node.js
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

// Test data
let authToken = '';
let productId = '';
let partnerId = '';

// Test credentials
const TEST_EMAIL = 'maria@brechodamaria.com';
const TEST_PASSWORD = 'senha123';

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
        let curlCmd = `curl -s -w "\\n%{http_code}" -X ${method} "${API_BASE}${endpoint}"`;
        
        // Add headers
        Object.keys(headers).forEach(key => {
            curlCmd += ` -H "${key}: ${headers[key]}"`;
        });
        
        // Add data for POST/PUT/PATCH requests
        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
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
        
        return { response, statusCode };
    } catch (error) {
        throw new Error(`Request failed: ${error.message}`);
    }
}

async function login() {
    console.log('\n🔐 === Login do Partner ===');
    
    try {
        const { response, statusCode } = await makeRequest('POST', '/api/auth/login', {
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        });
        
        if (statusCode === 200 && response.success && response.data?.token) {
            authToken = response.data.token;
            partnerId = response.data.user?.partnerId || response.data.partnerId;
            logTest('Partner Login', 'PASS');
            console.log(`   Partner ID: ${partnerId}`);
            return true;
        } else {
            logTest('Partner Login', 'FAIL', JSON.stringify(response));
            return false;
        }
    } catch (error) {
        logTest('Partner Login', 'FAIL', error.message);
        return false;
    }
}

async function testCreateProduct() {
    console.log('\n📦 === Test: Criar Produto ===');
    
    try {
        const { response, statusCode } = await makeRequest('POST', '/api/products', {
            name: 'Camiseta Vintage Rock Band',
            description: 'Camiseta original da banda Rolling Stones, tour 1981',
            price: '89.90',
            category: 'Roupas',
            brand: 'Rolling Stones',
            size: 'M',
            color: 'Preto',
            condition: 'GOOD',
            sku: 'SKU-TEST-001'
        }, {
            'Authorization': `Bearer ${authToken}`
        });
        
        if (statusCode === 201 && response.success) {
            productId = response.data?.id || response.data?.product?.id;
            logTest('Criar Produto', 'PASS');
            console.log(`   Product ID: ${productId}`);
        } else {
            logTest('Criar Produto', 'FAIL', `Status: ${statusCode}, Response: ${JSON.stringify(response)}`);
        }
    } catch (error) {
        logTest('Criar Produto', 'FAIL', error.message);
    }
}

async function testListProducts() {
    console.log('\n📋 === Test: Listar Produtos ===');
    
    try {
        const { response, statusCode } = await makeRequest('GET', '/api/products', null, {
            'Authorization': `Bearer ${authToken}`
        });
        
        if (statusCode === 200 && response.success) {
            const total = response.data?.total || response.data?.products?.length || 0;
            logTest('Listar Produtos', 'PASS');
            console.log(`   Total produtos: ${total}`);
        } else {
            logTest('Listar Produtos', 'FAIL', `Status: ${statusCode}, Response: ${JSON.stringify(response)}`);
        }
    } catch (error) {
        logTest('Listar Produtos', 'FAIL', error.message);
    }
}

async function testGetProductById() {
    console.log('\n🔍 === Test: Buscar Produto por ID ===');
    
    if (!productId) {
        console.log('   Pulando teste - sem ID de produto');
        return;
    }
    
    try {
        const { response, statusCode } = await makeRequest('GET', `/api/products/${productId}`, null, {
            'Authorization': `Bearer ${authToken}`
        });
        
        if (statusCode === 200 && response.success) {
            logTest('Buscar Produto por ID', 'PASS');
        } else {
            logTest('Buscar Produto por ID', 'FAIL', `Status: ${statusCode}, Response: ${JSON.stringify(response)}`);
        }
    } catch (error) {
        logTest('Buscar Produto por ID', 'FAIL', error.message);
    }
}

async function testUpdateProduct() {
    console.log('\n✏️ === Test: Atualizar Produto ===');
    
    if (!productId) {
        console.log('   Pulando teste - sem ID de produto');
        return;
    }
    
    try {
        const { response, statusCode } = await makeRequest('PUT', `/api/products/${productId}`, {
            name: 'Camiseta Vintage Rock Band - Edição Limitada',
            price: '119.90',
            description: 'Camiseta original da banda Rolling Stones, tour 1981. Edição limitada!'
        }, {
            'Authorization': `Bearer ${authToken}`
        });
        
        if (statusCode === 200 && response.success) {
            logTest('Atualizar Produto', 'PASS');
        } else {
            logTest('Atualizar Produto', 'FAIL', `Status: ${statusCode}, Response: ${JSON.stringify(response)}`);
        }
    } catch (error) {
        logTest('Atualizar Produto', 'FAIL', error.message);
    }
}

async function testUpdateProductStatus() {
    console.log('\n🔄 === Test: Atualizar Status do Produto ===');
    
    if (!productId) {
        console.log('   Pulando teste - sem ID de produto');
        return;
    }
    
    try {
        const { response, statusCode } = await makeRequest('PATCH', `/api/products/${productId}/status`, {
            status: 'RESERVED'
        }, {
            'Authorization': `Bearer ${authToken}`
        });
        
        if (statusCode === 200 && response.success) {
            logTest('Atualizar Status do Produto', 'PASS');
        } else {
            logTest('Atualizar Status do Produto', 'FAIL', `Status: ${statusCode}, Response: ${JSON.stringify(response)}`);
        }
    } catch (error) {
        logTest('Atualizar Status do Produto', 'FAIL', error.message);
    }
}

async function testListCategories() {
    console.log('\n📁 === Test: Listar Categorias ===');
    
    try {
        const { response, statusCode } = await makeRequest('GET', '/api/products/categories', null, {
            'Authorization': `Bearer ${authToken}`
        });
        
        if (statusCode === 200 && response.success) {
            logTest('Listar Categorias', 'PASS');
        } else {
            logTest('Listar Categorias', 'FAIL', `Status: ${statusCode}, Response: ${JSON.stringify(response)}`);
        }
    } catch (error) {
        logTest('Listar Categorias', 'FAIL', error.message);
    }
}

async function testSearchProducts() {
    console.log('\n🔎 === Test: Buscar Produtos com Filtros ===');
    
    // Test with search
    try {
        const { response, statusCode } = await makeRequest('GET', '/api/products?search=Vintage&limit=10', null, {
            'Authorization': `Bearer ${authToken}`
        });
        
        if (statusCode === 200 && response.success) {
            logTest('Busca por texto', 'PASS');
        } else {
            logTest('Busca por texto', 'FAIL', `Status: ${statusCode}, Response: ${JSON.stringify(response)}`);
        }
    } catch (error) {
        logTest('Busca por texto', 'FAIL', error.message);
    }
    
    // Test with category filter
    try {
        const { response, statusCode } = await makeRequest('GET', '/api/products?category=Roupas', null, {
            'Authorization': `Bearer ${authToken}`
        });
        
        if (statusCode === 200 && response.success) {
            logTest('Filtro por categoria', 'PASS');
        } else {
            logTest('Filtro por categoria', 'FAIL', `Status: ${statusCode}, Response: ${JSON.stringify(response)}`);
        }
    } catch (error) {
        logTest('Filtro por categoria', 'FAIL', error.message);
    }
    
    // Test with status filter
    try {
        const { response, statusCode } = await makeRequest('GET', '/api/products?status=AVAILABLE', null, {
            'Authorization': `Bearer ${authToken}`
        });
        
        if (statusCode === 200 && response.success) {
            logTest('Filtro por status', 'PASS');
        } else {
            logTest('Filtro por status', 'FAIL', `Status: ${statusCode}, Response: ${JSON.stringify(response)}`);
        }
    } catch (error) {
        logTest('Filtro por status', 'FAIL', error.message);
    }
}

async function testDeleteProduct() {
    console.log('\n🗑️ === Test: Deletar Produto ===');
    
    if (!productId) {
        console.log('   Pulando teste - sem ID de produto');
        return;
    }
    
    try {
        const { response, statusCode } = await makeRequest('DELETE', `/api/products/${productId}`, null, {
            'Authorization': `Bearer ${authToken}`
        });
        
        if (statusCode === 200 && response.success) {
            logTest('Deletar Produto', 'PASS');
        } else {
            logTest('Deletar Produto', 'FAIL', `Status: ${statusCode}, Response: ${JSON.stringify(response)}`);
        }
    } catch (error) {
        logTest('Deletar Produto', 'FAIL', error.message);
    }
}

async function testAuthorization() {
    console.log('\n🔒 === Test: Verificar Autorização ===');
    
    try {
        // Login as admin (no partner)
        const { response: adminResponse, statusCode: adminStatus } = await makeRequest('POST', '/api/auth/login', {
            email: 'admin@ebrecho.com.br',
            password: 'admin123'
        });
        
        if (adminStatus === 200 && adminResponse.success && adminResponse.data?.token) {
            const adminToken = adminResponse.data.token;
            
            // Try to create product with admin token (should fail)
            const { response, statusCode } = await makeRequest('POST', '/api/products', {
                name: 'Test Product',
                price: '10.00',
                category: 'Test',
                condition: 'NEW'
            }, {
                'Authorization': `Bearer ${adminToken}`
            });
            
            if (statusCode === 403 || (response.error && response.error.includes('not associated with a partner'))) {
                logTest('Verificar Autorização', 'PASS');
            } else {
                logTest('Verificar Autorização', 'FAIL', 'Admin conseguiu criar produto sem partner');
            }
        } else {
            logTest('Verificar Autorização', 'FAIL', 'Falha no login do admin');
        }
    } catch (error) {
        logTest('Verificar Autorização', 'FAIL', error.message);
    }
}

async function runTests() {
    console.log('\n🚀 ======================================');
    console.log('      Testes da API de Produtos');
    console.log('======================================\n');
    
    // Check if API is running
    console.log('🔍 Verificando se a API está rodando...');
    try {
        const { statusCode } = await makeRequest('GET', '/health');
        if (statusCode !== 200) {
            console.log('❌ API não está respondendo em http://localhost:3001');
            console.log('Por favor, inicie a API com "npm run dev" no diretório api/');
            process.exit(1);
        }
        console.log('✅ API está rodando\n');
    } catch (error) {
        console.log('❌ API não está respondendo em http://localhost:3001');
        console.log('Por favor, inicie a API com "npm run dev" no diretório api/');
        process.exit(1);
    }
    
    // Run tests
    const loginSuccess = await login();
    if (!loginSuccess) {
        console.log('\n❌ Login falhou. Abortando testes.');
        process.exit(1);
    }
    
    await testCreateProduct();
    await testListProducts();
    await testGetProductById();
    await testUpdateProduct();
    await testUpdateProductStatus();
    await testListCategories();
    await testSearchProducts();
    await testDeleteProduct();
    await testAuthorization();
    
    // Summary
    console.log('\n\n📊 ======================================');
    console.log('           RESUMO DOS TESTES');
    console.log('======================================');
    console.log(`✅ Testes aprovados: ${testResults.passed}`);
    console.log(`❌ Testes falhados: ${testResults.failed}`);
    console.log(`📝 Total de testes: ${testResults.passed + testResults.failed}`);
    
    if (testResults.failed === 0) {
        console.log('\n🎉 Todos os testes passaram!');
        process.exit(0);
    } else {
        console.log('\n⚠️  Alguns testes falharam');
        process.exit(1);
    }
}

// Run the tests
runTests().catch(error => {
    console.error('Erro ao executar testes:', error);
    process.exit(1);
});