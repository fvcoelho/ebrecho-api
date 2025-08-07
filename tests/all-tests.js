// Test Runner - Executes all test files in the tests directory
const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');

const execAsync = util.promisify(exec);

const API_BASE = 'http://localhost:3001';

// Test runner configuration
const testFiles = [
    'auth.test.js',
    'auth-simple.test.js', 
    'auth-security.test.js',
    'address.test.js',
    'product.test.js',
    'partner.test.js',
    'database.test.js'
];

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

// Overall test results
let overallResults = {
    totalFiles: 0,
    passedFiles: 0,
    failedFiles: 0,
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    results: []
};

function logSection(title) {
    console.log(`\n${colors.blue}${colors.bold}${'='.repeat(60)}${colors.reset}`);
    console.log(`${colors.blue}${colors.bold} ${title}${colors.reset}`);
    console.log(`${colors.blue}${colors.bold}${'='.repeat(60)}${colors.reset}\n`);
}

function logResult(message, isSuccess = true) {
    const color = isSuccess ? colors.green : colors.red;
    const icon = isSuccess ? '✅' : '❌';
    console.log(`${color}${icon} ${message}${colors.reset}`);
}

async function runDatabaseSeed() {
    try {
        console.log(`${colors.yellow}🌱 Running database seed...${colors.reset}`);
        const startTime = Date.now();
        
        const { stdout, stderr } = await execAsync('npx prisma db seed', {
            cwd: path.join(__dirname, '..')
        });
        
        const duration = Date.now() - startTime;
        
        if (stderr && !stderr.includes('🌱')) {
            console.log(`${colors.yellow}⚠️  Seed warnings:${colors.reset}`);
            console.log(stderr);
        }
        
        console.log(stdout);
        logResult(`Database seeded successfully (${duration}ms)`);
        return true;
        
    } catch (error) {
        console.log(`${colors.red}❌ Database seed failed:${colors.reset}`);
        if (error.stdout) {
            console.log(error.stdout);
        }
        if (error.stderr) {
            console.log(`${colors.red}Error: ${error.stderr}${colors.reset}`);
        }
        logResult(`Seed failed: ${error.message}`, false);
        return false;
    }
}

async function checkApiHealth() {
    try {
        const { stdout } = await execAsync(`curl -s -w "%{http_code}" -o /dev/null ${API_BASE}/health`);
        const statusCode = parseInt(stdout);
        
        if (statusCode === 200) {
            logResult('API is running and healthy');
            return true;
        } else {
            logResult(`API returned status code: ${statusCode}`, false);
            return false;
        }
    } catch (error) {
        logResult(`API health check failed: ${error.message}`, false);
        return false;
    }
}

async function runTestFile(filename) {
    const filePath = path.join(__dirname, filename);
    
    console.log(`\n${colors.yellow}📁 Running: ${filename}${colors.reset}`);
    console.log(`${colors.yellow}${'─'.repeat(50)}${colors.reset}`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        logResult(`File not found: ${filename}`, false);
        return {
            filename,
            success: false,
            error: 'File not found',
            passed: 0,
            failed: 1,
            total: 1,
            duration: 0
        };
    }
    
    const startTime = Date.now();
    
    try {
        // Execute the test file
        const { stdout, stderr } = await execAsync(`node "${filePath}"`);
        const duration = Date.now() - startTime;
        
        // Parse test results from output
        const result = parseTestOutput(stdout, filename);
        result.duration = duration;
        
        if (stderr) {
            console.log(`${colors.yellow}⚠️  Warnings:${colors.reset}`);
            console.log(stderr);
        }
        
        console.log(stdout);
        
        // Summary for this file
        console.log(`\n${colors.blue}📊 ${filename} Summary:${colors.reset}`);
        logResult(`Duration: ${duration}ms`);
        logResult(`Tests Passed: ${result.passed}/${result.total}`);
        
        if (result.failed > 0) {
            logResult(`Tests Failed: ${result.failed}`, false);
        }
        
        return result;
        
    } catch (error) {
        const duration = Date.now() - startTime;
        
        // For test files that exit with non-zero but have output, parse the output
        if (error.stdout) {
            console.log(error.stdout);
            
            // Parse test results from the output even if exit code is non-zero
            const result = parseTestOutput(error.stdout, filename);
            result.duration = duration;
            result.success = result.failed === 0 && result.total > 0;
            
            if (error.stderr) {
                console.log(`${colors.yellow}⚠️  Warnings:${colors.reset}`);
                console.log(error.stderr);
            }
            
            // Summary for this file
            console.log(`\n${colors.blue}📊 ${filename} Summary:${colors.reset}`);
            logResult(`Duration: ${duration}ms`);
            logResult(`Tests Passed: ${result.passed}/${result.total}`);
            
            if (result.failed > 0) {
                logResult(`Tests Failed: ${result.failed}`, false);
            }
            
            return result;
        } else {
            console.log(`${colors.red}❌ Test execution failed:${colors.reset}`);
            console.log(`${colors.red}Error: ${error.message}${colors.reset}`);
            
            return {
                filename,
                success: false,
                error: error.message,
                passed: 0,
                failed: 1,
                total: 1,
                duration
            };
        }
    }
}

function parseTestOutput(output, filename) {
    // Try to extract test results from the output
    let passed = 0;
    let failed = 0;
    let total = 0;
    
    // Look for patterns like "✅ Passed: X", "❌ Failed: Y", "📋 Total: Z"
    const passedMatch = output.match(/✅ Passed: (\d+)/);
    const failedMatch = output.match(/❌ Failed: (\d+)/);
    const totalMatch = output.match(/📋 Total: (\d+)/);
    
    if (passedMatch) passed = parseInt(passedMatch[1]);
    if (failedMatch) failed = parseInt(failedMatch[1]);
    if (totalMatch) total = parseInt(totalMatch[1]);
    
    // If we can't parse the structured output, try counting ✅ and ❌ symbols
    if (total === 0) {
        // Count test result symbols, excluding summary sections
        const lines = output.split('\n');
        let testPassed = 0;
        let testFailed = 0;
        
        for (const line of lines) {
            // Skip summary sections
            if (line.includes('Test Summary') || 
                line.includes('Passed:') || 
                line.includes('Failed:') ||
                line.includes('Total:') ||
                line.includes('Success Rate:')) {
                continue;
            }
            
            // Count actual test results
            if (line.trim().startsWith('✅')) {
                testPassed++;
            } else if (line.trim().startsWith('❌') && !line.includes('Failed:')) {
                testFailed++;
            }
        }
        
        passed = testPassed;
        failed = testFailed;
        total = passed + failed;
    }
    
    return {
        filename,
        success: failed === 0 && total > 0,
        passed,
        failed,
        total,
        error: failed > 0 ? `${failed} tests failed` : null
    };
}

function printOverallSummary() {
    logSection('🎯 OVERALL TEST SUMMARY');
    
    console.log(`${colors.bold}Test Files:${colors.reset}`);
    logResult(`Total Files: ${overallResults.totalFiles}`);
    logResult(`Passed Files: ${overallResults.passedFiles}`);
    if (overallResults.failedFiles > 0) {
        logResult(`Failed Files: ${overallResults.failedFiles}`, false);
    }
    
    console.log(`\n${colors.bold}Individual Tests:${colors.reset}`);
    logResult(`Total Tests: ${overallResults.totalTests}`);
    logResult(`Passed Tests: ${overallResults.passedTests}`);
    if (overallResults.failedTests > 0) {
        logResult(`Failed Tests: ${overallResults.failedTests}`, false);
    }
    
    const successRate = overallResults.totalTests > 0 
        ? ((overallResults.passedTests / overallResults.totalTests) * 100).toFixed(1)
        : 0;
    
    console.log(`\n${colors.bold}Success Rate: ${successRate}%${colors.reset}`);
    
    // File breakdown
    if (overallResults.results.length > 0) {
        console.log(`\n${colors.bold}File Breakdown:${colors.reset}`);
        overallResults.results.forEach(result => {
            const status = result.success ? '✅' : '❌';
            const fileRate = result.total > 0 
                ? ((result.passed / result.total) * 100).toFixed(1)
                : 0;
            console.log(`${status} ${result.filename}: ${result.passed}/${result.total} (${fileRate}%) - ${result.duration}ms`);
        });
    }
    
    // Overall status
    const allPassed = overallResults.failedFiles === 0 && overallResults.failedTests === 0;
    console.log(`\n${colors.bold}Overall Status: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}${colors.reset}`);
}

async function runAllTests() {
    logSection('🚀 EBRECHO API TEST SUITE');
    
    console.log(`${colors.yellow}Testing API at: ${API_BASE}${colors.reset}`);
    console.log(`${colors.yellow}Test files to run: ${testFiles.length}${colors.reset}\n`);
    
    // Check API health first
    logSection('🏥 API HEALTH CHECK');
    const isApiHealthy = await checkApiHealth();
    
    if (!isApiHealthy) {
        console.log(`\n${colors.red}❌ API is not available. Please start the API server first.${colors.reset}`);
        console.log(`${colors.yellow}Run: cd api && npm run dev${colors.reset}`);
        process.exit(1);
    }
    
    // Run database seed before tests
    logSection('🌱 DATABASE SETUP');
    const seedSuccess = await runDatabaseSeed();
    
    if (!seedSuccess) {
        console.log(`\n${colors.red}❌ Database seed failed. Tests may not run correctly.${colors.reset}`);
        console.log(`${colors.yellow}Please check database connection and schema.${colors.reset}`);
        // Continue anyway as some tests might still work
    }
    
    // Run each test file
    logSection('🧪 RUNNING TESTS');
    
    for (const filename of testFiles) {
        const result = await runTestFile(filename);
        
        // Update overall results
        overallResults.totalFiles++;
        overallResults.totalTests += result.total;
        overallResults.passedTests += result.passed;
        overallResults.failedTests += result.failed;
        overallResults.results.push(result);
        
        if (result.success) {
            overallResults.passedFiles++;
        } else {
            overallResults.failedFiles++;
        }
        
        // Small delay between tests
        if (testFiles.indexOf(filename) < testFiles.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    // Print overall summary
    printOverallSummary();
    
    // Exit with appropriate code
    const exitCode = overallResults.failedFiles > 0 || overallResults.failedTests > 0 ? 1 : 0;
    process.exit(exitCode);
}

// Handle script execution
if (require.main === module) {
    runAllTests().catch(error => {
        console.error(`${colors.red}❌ Test runner failed: ${error.message}${colors.reset}`);
        process.exit(1);
    });
}

module.exports = { runAllTests, runTestFile };