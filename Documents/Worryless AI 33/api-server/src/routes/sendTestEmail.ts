import type { RequestHandler } from 'express';
import { Resend } from 'resend';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendTestEmail: RequestHandler = async (req, res) => {
  try {
    const userId = (req as AuthedRequest).auth!.userId;

    console.log(`[send-test-email] Sending test email for user ${userId}`);

    // Get user email from users table
    const { rows: userRows } = await pool.query(
      'SELECT email FROM users WHERE id = $1',
      [userId],
    );

    const userEmail = userRows[0]?.email;
    if (!userEmail) {
      res.status(400).json({ error: 'User email not found' });
      return;
    }

    // Get user's profile for personalization
    const { rows: profileRows } = await pool.query(
      'SELECT business_name FROM profiles WHERE user_id = $1',
      [userId],
    );

    const businessName = profileRows[0]?.business_name || 'your business';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <tr>
                    <td style="padding: 40px; text-align: center; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);">
                      <h1 style="color: white; margin: 0; font-size: 24px;">Email Test Successful!</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px;">
                      <p style="color: #3f3f46; margin: 0 0 20px 0; font-size: 16px;">
                        Hi there!
                      </p>
                      <p style="color: #3f3f46; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                        This is a test email from <strong>Worryless AI</strong>. If you're reading this, it means your email integration is working perfectly!
                      </p>

                      <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
                        <h3 style="color: #18181b; margin: 0 0 12px 0; font-size: 16px;">What's working:</h3>
                        <ul style="color: #52525b; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
                          <li>Email sending via Resend</li>
                          <li>Custom domain (worryless.ai)</li>
                          <li>User authentication</li>
                          <li>HTML email templates</li>
                        </ul>
                      </div>

                      <p style="color: #3f3f46; margin: 24px 0; font-size: 16px; line-height: 1.6;">
                        Your AI team is now ready to send you:
                      </p>

                      <ul style="color: #52525b; margin: 0 0 24px 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
                        <li>Daily briefings from your Personal Assistant</li>
                        <li>Task validation requests when approval is needed</li>
                        <li>Important notifications from your AI agents</li>
                      </ul>

                      <p style="color: #71717a; margin: 32px 0 0 0; font-size: 13px;">
                        Business: ${businessName}
                      </p>
                      <p style="color: #a1a1aa; margin: 8px 0 0 0; font-size: 12px;">
                        Sent at ${new Date().toLocaleString()}
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 40px; background-color: #fafafa; border-top: 1px solid #e4e4e7;">
                      <p style="color: #71717a; margin: 0; font-size: 12px; text-align: center;">
                        This is a test email from Worryless AI. You can safely ignore it.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: 'Worryless AI Team <myteam@worryless.ai>',
      to: [userEmail],
      subject: 'Test Email from Worryless AI',
      html: emailHtml,
    });

    console.log('[send-test-email] Sent successfully:', emailResponse);

    res.json({
      success: true,
      message: `Test email sent to ${userEmail}`,
      emailId: emailResponse.data?.id,
    });
  } catch (error) {
    console.error('[send-test-email] Error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
