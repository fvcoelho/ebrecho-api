import nodemailer from 'nodemailer';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface EmailConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private from: string;
  private initialized = false;

  constructor() {
    this.from = `${process.env.FROM_NAME || 'eBrecho'} <${process.env.FROM_EMAIL || 'noreply@ebrecho.com.br'}>`;
  }

  private initialize() {
    if (this.initialized) return;

    console.log('🔧 Initializing Email Service...');
    console.log('📧 Using SMTP settings:');
    console.log(`  Host: ${process.env.SMTP_HOST || 'smtp.gmail.com'}`);
    console.log(`  Port: ${process.env.SMTP_PORT || '587'}`);
    console.log(`  User: ${process.env.SMTP_USER || '<your-email>'}`);
    console.log(`  Pass: ${process.env.SMTP_PASS ? '******' : '<your-password>'}`);
    console.log(`  From: ${process.env.FROM_EMAIL || '<your-email>'}`);
    console.log(`  Name: ${process.env.FROM_NAME || '<name>'}`);
    
    this.from = `${process.env.FROM_NAME || 'eBrecho'} <${process.env.FROM_EMAIL || 'noreply@ebrecho.com.br'}>`;

    // For production, use real SMTP settings
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465', // true for 465 (SSL), false for 587 (STARTTLS)
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        // Do not fail on invalid certificates
        rejectUnauthorized: false,
        // Enable STARTTLS for port 587
        ciphers: 'SSLv3'
      }
    });
      
    this.initialized = true;
    
    // Test connection on initialization
    this.testConnection();
  }
  
  private async testConnection(): Promise<void> {
    if (!this.transporter) return;
    
    try {
      await this.transporter.verify();
      console.log('✅ Email service connected successfully');
    } catch (error: any) {
      console.error('⚠️  Email service connection failed:', error.message);
      console.error('   Will attempt to send emails anyway...');
    }
  }

  private loadTemplate(templateName: string, variables: Record<string, string>): string {
    try {
      const templatePath = path.join(__dirname, '..', 'templates', templateName);
      let template = fs.readFileSync(templatePath, 'utf-8');
      
      // Replace variables in template
      Object.keys(variables).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        template = template.replace(regex, variables[key]);
      });
      
      return template;
    } catch (error) {
      console.error(`Failed to load template ${templateName}:`, error);
      // Return a basic template if file loading fails
      if (templateName.includes('.html')) {
        return `<h1>eBrecho</h1><p>${variables.name}, please verify your email: ${variables.verificationUrl}</p>`;
      }
      return `eBrecho\n${variables.name}, please verify your email: ${variables.verificationUrl}`;
    }
  }

  async sendVerificationEmail(email: string, token: string, name: string): Promise<void> {
    this.initialize();
    if (!this.transporter) throw new Error('Email service not initialized');

    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verificar-email?token=${token}`;
    
    // Load templates with variables
    const templateVariables = {
      name,
      verificationUrl
    };
    
    const htmlContent = this.loadTemplate('email-verification.html', templateVariables);
    const textContent = this.loadTemplate('email-verification.txt', templateVariables);

    const mailOptions = {
      from: this.from,
      to: email,
      subject: 'Verificação de Email - eBrecho',
      text: textContent,
      html: htmlContent
    };

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 [DEV] Email de verificação seria enviado para:', email);
        console.log('🔗 [DEV] Link de verificação:', verificationUrl);
        console.log('📄 [DEV] Conteúdo do email:\n', textContent);
        
        // Actually try to send in development too if configured
        if (process.env.SMTP_USER && process.env.SMTP_PASS) {
          try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('✅ [DEV] Email realmente enviado!');
            console.log('📧 Message ID:', info.messageId);
          } catch (devError: any) {
            console.error('⚠️  [DEV] Falha ao enviar email (continuando):', devError.message);
          }
        }
      } else {
        const info = await this.transporter.sendMail(mailOptions);
        console.log('📧 Email de verificação enviado para:', email);
        console.log('📧 Message ID:', info.messageId);
        console.log('📧 Response:', info.response);
      }
    } catch (error: any) {
      console.error('❌ Erro ao enviar email de verificação:', error);
      console.error('   Code:', error.code);
      console.error('   Message:', error.message);
      
      if (error.code === 'EAUTH') {
        console.error('   🔐 Erro de autenticação - verifique SMTP_USER e SMTP_PASS');
      } else if (error.code === 'ESOCKET') {
        console.error('   🔌 Erro de conexão - verifique SMTP_HOST e SMTP_PORT');
      }
      
      throw new Error('Falha ao enviar email de verificação');
    }
  }

  async sendTestEmail(
    email: string, 
    subject: string, 
    textContent: string, 
    htmlContent: string
  ): Promise<{ messageId: string; response?: string }> {
    this.initialize();
    if (!this.transporter) throw new Error('Email service not initialized');

    const mailOptions = {
      from: this.from,
      to: email,
      subject,
      text: textContent,
      html: htmlContent
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('📧 Test email sent successfully');
      console.log('📧 Message ID:', info.messageId);
      console.log('📧 Response:', info.response);
      
      return {
        messageId: info.messageId,
        response: info.response
      };
    } catch (error: any) {
      console.error('❌ Error sending test email:', error);
      throw error;
    }
  }

  generateVerificationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  getTokenExpiration(): Date {
    const expiration = new Date();
    expiration.setHours(expiration.getHours() + 24); // 24 horas
    return expiration;
  }
}

export const emailService = new EmailService();