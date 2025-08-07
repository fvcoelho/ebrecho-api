const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmailConnection() {
  console.log('🔧 Testing Email Service Connection...');
  console.log('📧 Using SMTP settings:');
  console.log(`  Host: ${process.env.SMTP_HOST || 'smtp.gmail.com'}`);
  console.log(`  Port: ${process.env.SMTP_PORT || '587'}`);
  console.log(`  Secure: ${process.env.SMTP_PORT === '465' ? 'true (SSL)' : 'false (STARTTLS)'}`);
  console.log(`  User: ${process.env.SMTP_USER || '<not configured>'}`);
  console.log(`  Pass: ${process.env.SMTP_PASS ? '******' : '<not configured>'}`);
  console.log(`  From: ${process.env.FROM_EMAIL || 'noreply@ebrecho.com.br'}`);
  console.log('');

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error('❌ Error: SMTP_USER and SMTP_PASS environment variables are required');
    console.log('\nPlease configure your .env file with:');
    console.log('SMTP_HOST=smtp.gmail.com');
    console.log('SMTP_PORT=587');
    console.log('SMTP_USER=your-email@gmail.com');
    console.log('SMTP_PASS=your-app-password');
    console.log('\nFor Gmail, you need to:');
    console.log('1. Enable 2-factor authentication');
    console.log('2. Generate an app password at: https://myaccount.google.com/apppasswords');
    return;
  }

  try {
    // Create transporter with current configuration
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      debug: true, // Enable debug output
      logger: true // Enable logging
    });

    console.log('🔍 Verifying SMTP connection...\n');
    
    // Verify connection
    await transporter.verify();
    
    console.log('✅ SMTP connection successful!');
    console.log('\n📧 Sending test email...');

    // Send test email
    const testEmail = process.env.SMTP_USER; // Send to self for testing
    const info = await transporter.sendMail({
      from: `"eBrecho Test" <${ process.env.FROM_EMAIL || process.env.SMTP_USER}>`,
      to: testEmail,
      subject: 'eBrecho - Test Email',
      text: 'This is a test email from eBrecho email service.',
      html: `
        <h2>eBrecho Email Test</h2>
        <p>This is a test email from eBrecho email service.</p>
        <p>If you received this email, your SMTP configuration is working correctly! ✅</p>
        <hr>
        <p><small>Sent at: ${new Date().toLocaleString()}</small></p>
      `
    });

    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Sent to: ${testEmail}`);
    console.log('\n🎉 Email service is working correctly!');

  } catch (error) {
    console.error('\n❌ Email service test failed!');
    console.error(`   Error: ${error.message}`);
    
    if (error.code === 'EAUTH') {
      console.error('\n🔐 Authentication Error:');
      console.error('   - Check your SMTP_USER and SMTP_PASS');
      console.error('   - For Gmail: Use an app password, not your regular password');
      console.error('   - Generate app password at: https://myaccount.google.com/apppasswords');
    } else if (error.code === 'ESOCKET' || error.code === 'ECONNECTION') {
      console.error('\n🔌 Connection Error:');
      console.error('   - Check your SMTP_HOST and SMTP_PORT');
      console.error('   - Common ports: 587 (STARTTLS), 465 (SSL), 25 (non-secure)');
      console.error('   - Ensure firewall/network allows outbound SMTP');
    }
    
    console.error('\nFull error details:', error);
  }
}

// Run the test
testEmailConnection();