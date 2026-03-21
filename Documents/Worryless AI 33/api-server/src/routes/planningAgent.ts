import type { Response } from 'express';
import type { AuthedRequest } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

// Default task templates for each agent with risk levels
const defaultTaskTemplates: Record<
  string,
  Array<{
    title: string;
    description: string;
    schedule_cron: string;
    frequency: string;
    risk_level: string;
  }>
> = {
  accountant: [
    {
      title: 'Daily Financial Summary',
      description: 'Review pending invoices and generate a daily financial status update',
      schedule_cron: '0 9 * * *',
      frequency: 'daily',
      risk_level: 'low',
    },
    {
      title: 'Weekly Cashflow Report',
      description: 'Analyze income vs expenses and generate weekly cashflow report',
      schedule_cron: '0 9 * * 1',
      frequency: 'weekly',
      risk_level: 'low',
    },
    {
      title: 'Monthly P&L Statement',
      description: 'Generate comprehensive profit and loss statement for the month',
      schedule_cron: '0 9 1 * *',
      frequency: 'monthly',
      risk_level: 'low',
    },
  ],
  marketer: [
    {
      title: 'Daily Content Ideas',
      description: 'Generate social media content ideas based on business and industry trends',
      schedule_cron: '0 8 * * *',
      frequency: 'daily',
      risk_level: 'low',
    },
    {
      title: 'Create Instagram Post',
      description: 'Create and schedule an engaging Instagram post with image',
      schedule_cron: '0 10 * * *',
      frequency: 'daily',
      risk_level: 'high',
    },
    {
      title: 'Weekly Content Performance Review',
      description: 'Analyze engagement metrics and recommend content strategy adjustments',
      schedule_cron: '0 9 * * 5',
      frequency: 'weekly',
      risk_level: 'low',
    },
  ],
  sales_rep: [
    {
      title: 'Daily Lead Research',
      description: 'Research and identify potential new leads based on target market',
      schedule_cron: '0 8 * * *',
      frequency: 'daily',
      risk_level: 'low',
    },
    {
      title: 'Generate Outreach Emails',
      description: 'Create personalized outreach emails for qualified leads',
      schedule_cron: '0 10 * * *',
      frequency: 'daily',
      risk_level: 'high',
    },
    {
      title: 'Weekly Pipeline Review',
      description: 'Review sales pipeline status and recommend follow-up actions',
      schedule_cron: '0 9 * * 1',
      frequency: 'weekly',
      risk_level: 'low',
    },
    {
      title: 'Monthly Conversion Analysis',
      description: 'Analyze lead conversion rates and recommend improvements',
      schedule_cron: '0 9 1 * *',
      frequency: 'monthly',
      risk_level: 'low',
    },
  ],
  personal_assistant: [
    {
      title: 'Morning Briefing',
      description: 'Generate and send a daily morning briefing with priorities, urgent emails, and today\'s schedule',
      schedule_cron: '0 7 * * *',
      frequency: 'daily',
      risk_level: 'low',
    },
    {
      title: 'Calendar Review',
      description: 'Review upcoming calendar events and prepare for important meetings',
      schedule_cron: '0 8 * * 1',
      frequency: 'weekly',
      risk_level: 'low',
    },
    {
      title: 'Email Triage',
      description: 'Process and categorize unread emails, identify urgent items requiring attention',
      schedule_cron: '0 9 * * *',
      frequency: 'daily',
      risk_level: 'low',
    },
    {
      title: 'Draft Email Responses',
      description: 'Draft responses for emails that require a reply',
      schedule_cron: '0 14 * * *',
      frequency: 'daily',
      risk_level: 'high',
    },
    {
      title: 'Weekly Summary',
      description: 'Generate a comprehensive weekly summary of completed tasks, key events, and next week\'s priorities',
      schedule_cron: '0 17 * * 5',
      frequency: 'weekly',
      risk_level: 'low',
    },
  ],
};

// Fetch business context for AI personalization
async function fetchBusinessContext(userId: string) {
  const [profileRes, artifactsRes] = await Promise.all([
    pool.query(`SELECT * FROM profiles WHERE user_id = $1`, [userId]),
    pool.query(`SELECT * FROM business_artifacts WHERE user_id = $1`, [userId]),
  ]);

  return {
    profile: profileRes.rows[0] || null,
    artifacts: artifactsRes.rows || [],
  };
}

// Generate personalized task description using business context
function personalizeTask(
  task: { description: string },
  businessContext: { profile: Record<string, any> | null; artifacts: any[] },
): string {
  const { profile } = businessContext;

  if (!profile?.business_name) {
    return task.description;
  }

  const businessInfo = `
Business: ${profile.business_name || 'Unknown'}
Industry: ${profile.industry || 'Unknown'}
Location: ${profile.city || ''}, ${profile.country || ''}
Description: ${profile.company_description || ''}
  `.trim();

  return `${task.description}\n\nBusiness Context:\n${businessInfo}`;
}

function calculateNextRun(cronExpression: string): Date {
  const now = new Date();
  const parts = cronExpression.split(' ');

  if (parts.length !== 5) {
    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const next = new Date(now);

  // Daily schedule
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    const targetHour = hour === '*' ? now.getHours() : parseInt(hour);
    const targetMinute = minute === '*' ? 0 : parseInt(minute);
    next.setHours(targetHour, targetMinute, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    return next;
  }

  // Weekly schedule
  if (dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    const targetDay = parseInt(dayOfWeek);
    const targetHour = hour === '*' ? 9 : parseInt(hour);
    const targetMinute = minute === '*' ? 0 : parseInt(minute);
    next.setHours(targetHour, targetMinute, 0, 0);
    const currentDay = now.getDay();
    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget <= 0 || (daysUntilTarget === 0 && next <= now)) {
      daysUntilTarget += 7;
    }
    next.setDate(next.getDate() + daysUntilTarget);
    return next;
  }

  // Monthly schedule
  if (dayOfMonth !== '*' && month === '*') {
    const targetDay = parseInt(dayOfMonth);
    const targetHour = hour === '*' ? 9 : parseInt(hour);
    const targetMinute = minute === '*' ? 0 : parseInt(minute);
    next.setDate(targetDay);
    next.setHours(targetHour, targetMinute, 0, 0);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
    }
    return next;
  }

  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

export const planningAgent = async (req: AuthedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.auth!.userId;
    const { action } = req.body;

    console.log(`Planning agent action: ${action} for user: ${userId}`);

    if (action === 'initialize') {
      const businessContext = await fetchBusinessContext(userId);
      console.log('Business context loaded:', businessContext.profile?.business_name);

      // Create automation settings for each agent
      const agentTypes = ['accountant', 'marketer', 'sales_rep', 'personal_assistant'];
      for (const agentType of agentTypes) {
        await pool.query(
          `INSERT INTO automation_settings (user_id, agent_type, is_enabled)
           VALUES ($1, $2, true)
           ON CONFLICT (user_id, agent_type) DO UPDATE SET is_enabled = true`,
          [userId, agentType],
        );
      }

      // Create personalized task templates for each agent
      const createdTemplates: Array<Record<string, any>> = [];

      for (const [agentType, templates] of Object.entries(defaultTaskTemplates)) {
        for (const template of templates) {
          const personalizedDescription = personalizeTask(template, businessContext);

          const result = await pool.query(
            `INSERT INTO task_templates (user_id, agent_type, title, description, schedule_cron, frequency, risk_level, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, true)
             RETURNING *`,
            [userId, agentType, template.title, personalizedDescription, template.schedule_cron, template.frequency, template.risk_level],
          );

          if (result.rows[0]) {
            createdTemplates.push(result.rows[0]);
          }
        }
      }

      // Enable automation on the profile
      await pool.query(
        `UPDATE profiles SET automation_enabled = true WHERE user_id = $1`,
        [userId],
      );

      // Create initial scheduled tasks from templates
      const scheduledTasks: Array<Record<string, any>> = [];
      for (const template of createdTemplates) {
        const nextRun = calculateNextRun(template.schedule_cron);

        const taskResult = await pool.query(
          `INSERT INTO agent_tasks (user_id, agent_type, title, message, status, is_recurring, schedule_cron, next_run_at, task_config)
           VALUES ($1, $2, $3, $4, 'scheduled', true, $5, $6, $7)
           RETURNING *`,
          [
            userId,
            template.agent_type,
            template.title,
            template.description,
            template.schedule_cron,
            nextRun.toISOString(),
            JSON.stringify({
              template_id: template.id,
              risk_level: template.risk_level,
              frequency: template.frequency,
            }),
          ],
        );

        if (taskResult.rows[0]) {
          scheduledTasks.push(taskResult.rows[0]);
        }
      }

      res.json({
        success: true,
        message: 'Automation initialized',
        templatesCreated: createdTemplates.length,
        tasksScheduled: scheduledTasks.length,
      });
      return;
    }

    if (action === 'disable') {
      await pool.query(
        `UPDATE profiles SET automation_enabled = false WHERE user_id = $1`,
        [userId],
      );

      await pool.query(
        `UPDATE agent_tasks SET status = 'pending' WHERE user_id = $1 AND status = 'scheduled' AND is_recurring = true`,
        [userId],
      );

      res.json({ success: true, message: 'Automation disabled' });
      return;
    }

    if (action === 'enable') {
      await pool.query(
        `UPDATE profiles SET automation_enabled = true WHERE user_id = $1`,
        [userId],
      );

      const templatesRes = await pool.query(
        `SELECT * FROM task_templates WHERE user_id = $1 AND is_active = true`,
        [userId],
      );

      if (templatesRes.rows.length > 0) {
        for (const template of templatesRes.rows) {
          const nextRun = calculateNextRun(template.schedule_cron);

          await pool.query(
            `INSERT INTO agent_tasks (user_id, agent_type, title, message, status, is_recurring, schedule_cron, next_run_at, task_config)
             VALUES ($1, $2, $3, $4, 'scheduled', true, $5, $6, $7)`,
            [
              userId,
              template.agent_type,
              template.title,
              template.description,
              template.schedule_cron,
              nextRun.toISOString(),
              JSON.stringify({
                template_id: template.id,
                risk_level: template.risk_level,
                frequency: template.frequency,
              }),
            ],
          );
        }
      }

      res.json({ success: true, message: 'Automation re-enabled' });
      return;
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error: unknown) {
    console.error('Planning agent error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
};
