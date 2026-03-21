import type { RequestHandler } from 'express';
import { Resend } from 'resend';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

const resend = new Resend(process.env.RESEND_API_KEY);

interface ValidationEmailRequest {
  taskId: string;
  userId: string;
}

export const sendValidationEmail: RequestHandler = async (req, res) => {
  try {
    const authedUserId = (req as AuthedRequest).auth!.userId;
    const { taskId, userId }: ValidationEmailRequest = req.body;

    // Use the userId from the body if provided (for admin flows), otherwise fall back to JWT user
    const targetUserId = userId || authedUserId;

    console.log(`[send-validation-email] Sending for task ${taskId}`);

    // Get task details
    const { rows: taskRows } = await pool.query(
      'SELECT * FROM agent_tasks WHERE id = $1',
      [taskId],
    );

    const task = taskRows[0];
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Get validator for this agent type
    const { rows: validatorRows } = await pool.query(
      'SELECT * FROM agent_validators WHERE user_id = $1 AND agent_type = $2',
      [targetUserId, task.agent_type],
    );

    const validator = validatorRows[0];
    if (!validator) {
      console.log('[send-validation-email] No validator found, skipping email');
      res.json({ skipped: true });
      return;
    }

    // Generate validation token
    const validationToken = crypto.randomUUID();

    // Update task with validation token
    await pool.query(
      `UPDATE agent_tasks SET validation_token = $1, validation_email_sent_at = $2 WHERE id = $3`,
      [validationToken, new Date().toISOString(), taskId],
    );

    // Get business name for email
    const { rows: profileRows } = await pool.query(
      'SELECT business_name FROM profiles WHERE user_id = $1',
      [targetUserId],
    );

    const businessName = profileRows[0]?.business_name || 'Your business';
    const appUrl = process.env.APP_URL || 'https://worryless.ai';
    const reviewUrl = `${appUrl}/dashboard?task=${taskId}&token=${validationToken}`;

    const agentNames: Record<string, string> = {
      accountant: 'Alex (AI Accountant)',
      marketer: 'Maya (AI Marketer)',
      sales_rep: 'Sam (AI Sales Rep)',
      personal_assistant: 'Riley (AI Personal Assistant)',
    };

    const agentName = agentNames[task.agent_type] || 'Your AI Agent';

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
                      <h1 style="color: white; margin: 0; font-size: 24px;">Task Needs Your Review</h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 40px;">
                      <p style="color: #71717a; margin: 0 0 20px 0; font-size: 16px;">
                        Hi ${validator.validator_name},
                      </p>
                      <p style="color: #3f3f46; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                        <strong>${agentName}</strong> has completed a task for <strong>${businessName}</strong> and needs your approval before proceeding.
                      </p>

                      <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin: 24px 0;">
                        <h3 style="color: #18181b; margin: 0 0 12px 0; font-size: 16px;">${task.title || 'Task'}</h3>
                        <p style="color: #52525b; margin: 0; font-size: 14px; line-height: 1.5;">${task.message}</p>
                        ${task.response ? `
                          <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e4e4e7;">
                            <p style="color: #71717a; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Agent Output</p>
                            <p style="color: #3f3f46; margin: 0; font-size: 14px; line-height: 1.5;">${task.response.substring(0, 500)}${task.response.length > 500 ? '...' : ''}</p>
                          </div>
                        ` : ''}
                      </div>

                      <a href="${reviewUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 16px; font-weight: 600; margin-top: 8px;">
                        Review &amp; Approve
                      </a>

                      <p style="color: #a1a1aa; margin: 32px 0 0 0; font-size: 13px;">
                        You're receiving this because you're set as the validator for ${agentName.split(' (')[0]}'s tasks.
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
      to: [validator.validator_email],
      subject: `${agentName} needs your approval`,
      html: emailHtml,
    });

    console.log('[send-validation-email] Email sent successfully:', emailResponse);

    res.json({ success: true, emailResponse });
  } catch (error) {
    console.error('[send-validation-email] Error:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
};
