import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/roles.middleware';
import { emailService } from '../utils/email.utils';
import { AuthRequest } from '../types';

const router = Router();

// All system routes require authentication and admin role
router.use(authenticate);
router.use(authorize(['ADMIN']));

/**
 * @swagger
 * /api/system/test-email:
 *   post:
 *     summary: Send test email
 *     description: Send a test email to fvcoelho@me.com to verify email service configuration. Admin only.
 *     tags: [System]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Test email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Test email sent successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     recipient:
 *                       type: string
 *                       example: fvcoelho@me.com
 *                     messageId:
 *                       type: string
 *                       example: <message-id@example.com>
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                       example: 2024-08-08T13:30:00.000Z
 *                     environment:
 *                       type: string
 *                       example: development
 *                     smtpConfig:
 *                       type: object
 *                       properties:
 *                         host:
 *                           type: string
 *                         port:
 *                           type: number
 *                         secure:
 *                           type: boolean
 *       400:
 *         description: Email service configuration error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: SMTP configuration missing
 *                 details:
 *                   type: object
 *                   description: Error details and configuration help
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         description: Email sending failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Failed to send test email
 *                 details:
 *                   type: object
 *                   description: Detailed error information
 */
router.post('/test-email', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const testRecipient = 'fvcoelho@me.com';
  const timestamp = new Date();
  
  try {
    console.log(`🧪 [SYSTEM] Test email requested by user: ${req.user?.email} (${req.user?.role})`);
    console.log(`📧 [SYSTEM] Sending test email to: ${testRecipient}`);
    
    // Check SMTP configuration
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(400).json({
        success: false,
        error: 'SMTP configuration missing',
        details: {
          message: 'SMTP_USER and SMTP_PASS environment variables are required',
          requiredEnvVars: ['SMTP_USER', 'SMTP_PASS', 'SMTP_HOST', 'SMTP_PORT'],
          currentConfig: {
            host: process.env.SMTP_HOST || 'not configured',
            port: process.env.SMTP_PORT || 'not configured',
            user: process.env.SMTP_USER ? '***configured***' : 'not configured',
            pass: process.env.SMTP_PASS ? '***configured***' : 'not configured'
          }
        }
      });
    }

    // Prepare test email content
    const emailContent = {
      subject: '🧪 eBrecho API - Email Service Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">👗 eBrecho API</h1>
            <p style="margin: 10px 0 0 0; font-size: 16px;">Email Service Test</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; margin: 20px 0;">
            <h2 style="color: #333; margin-top: 0;">✅ Email Service Working!</h2>
            <p style="color: #666; line-height: 1.6;">
              This test email confirms that the eBrecho API email service is configured correctly 
              and can successfully send emails.
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea;">
              <h3 style="margin-top: 0; color: #333;">Test Details:</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Timestamp:</td>
                  <td style="padding: 8px 0; color: #333;">${timestamp.toISOString()}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Environment:</td>
                  <td style="padding: 8px 0; color: #333;">${process.env.NODE_ENV || 'development'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">API Version:</td>
                  <td style="padding: 8px 0; color: #333;">1.0.1</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">SMTP Host:</td>
                  <td style="padding: 8px 0; color: #333;">${process.env.SMTP_HOST || 'smtp.gmail.com'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">SMTP Port:</td>
                  <td style="padding: 8px 0; color: #333;">${process.env.SMTP_PORT || '587'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; font-weight: bold;">Requested by:</td>
                  <td style="padding: 8px 0; color: #333;">${req.user?.email} (${req.user?.role})</td>
                </tr>
              </table>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
              <p style="color: #999; font-size: 14px; margin: 0;">
                This email was automatically generated by the eBrecho API system test endpoint.
              </p>
              <p style="color: #999; font-size: 14px; margin: 5px 0 0 0;">
                © 2024 eBrecho. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
🧪 eBrecho API - Email Service Test

✅ Email Service Working!

This test email confirms that the eBrecho API email service is configured correctly and can successfully send emails.

Test Details:
- Timestamp: ${timestamp.toISOString()}
- Environment: ${process.env.NODE_ENV || 'development'}
- API Version: 1.0.1
- SMTP Host: ${process.env.SMTP_HOST || 'smtp.gmail.com'}
- SMTP Port: ${process.env.SMTP_PORT || '587'}
- Requested by: ${req.user?.email} (${req.user?.role})

This email was automatically generated by the eBrecho API system test endpoint.
© 2024 eBrecho. All rights reserved.
      `.trim()
    };

    // Send the test email using the existing email service
    const result = await emailService.sendTestEmail(
      testRecipient,
      emailContent.subject,
      emailContent.text,
      emailContent.html
    );

    console.log('✅ [SYSTEM] Test email sent successfully');
    console.log(`📧 [SYSTEM] Message ID: ${result.messageId}`);

    // Return success response
    res.json({
      success: true,
      message: 'Test email sent successfully',
      data: {
        recipient: testRecipient,
        messageId: result.messageId,
        timestamp: timestamp.toISOString(),
        environment: process.env.NODE_ENV || 'development',
        smtpConfig: {
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_PORT === '465',
          user: process.env.SMTP_USER ? '***configured***' : 'not configured'
        },
        requestedBy: {
          email: req.user?.email,
          role: req.user?.role
        }
      }
    });

  } catch (error: any) {
    console.error('❌ [SYSTEM] Failed to send test email:', error);
    
    // Determine error type and provide helpful information
    let errorDetails: any = {
      message: error.message,
      code: error.code,
      timestamp: timestamp.toISOString()
    };

    if (error.code === 'EAUTH') {
      errorDetails.help = {
        issue: 'Authentication failed',
        solution: 'Check SMTP_USER and SMTP_PASS environment variables',
        note: 'For Gmail, use an app password: https://myaccount.google.com/apppasswords'
      };
    } else if (error.code === 'ESOCKET' || error.code === 'ECONNECTION') {
      errorDetails.help = {
        issue: 'Connection failed',
        solution: 'Check SMTP_HOST and SMTP_PORT configuration',
        commonPorts: {
          'STARTTLS': 587,
          'SSL': 465,
          'Non-secure': 25
        }
      };
    }

    res.status(500).json({
      success: false,
      error: 'Failed to send test email',
      details: errorDetails
    });
  }
});

export default router;