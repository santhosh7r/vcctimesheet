import { graphFetch } from '../_lib/graph-client.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { employeeEmail, employeeName, managerName, taskTitle, taskDescription, taskDate, taskPriority, estimatedHours } = req.body || {};

  if (!employeeEmail || !taskTitle) {
    return res.status(400).json({ error: 'employeeEmail and taskTitle are required' });
  }

  const senderEmail = process.env.AZURE_SENDER_EMAIL || 'sysadmin@d4insight.com';

  const priorityColors = {
    low: '#64748b',
    medium: '#2563eb',
    high: '#f59e0b',
    urgent: '#ef4444',
  };
  const color = priorityColors[taskPriority] || '#2563eb';

  const htmlBody = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <div style="background: linear-gradient(135deg, #6366f1, #4f46e5); border-radius: 12px; padding: 24px; margin-bottom: 20px;">
        <h2 style="color: #fff; margin: 0 0 4px;">New Task Assigned</h2>
        <p style="color: rgba(255,255,255,0.8); margin: 0; font-size: 14px;">You have a new task from ${managerName || 'your manager'}</p>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
        <h3 style="margin: 0 0 12px; color: #1e293b; font-size: 16px;">${taskTitle}</h3>
        ${taskDescription ? `<p style="color: #64748b; font-size: 14px; margin: 0 0 16px; line-height: 1.5;">${taskDescription}</p>` : ''}
        <table style="width: 100%; font-size: 13px; color: #475569;">
          <tr>
            <td style="padding: 6px 0;"><strong>Date:</strong></td>
            <td style="padding: 6px 0;">${taskDate || 'Not specified'}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0;"><strong>Priority:</strong></td>
            <td style="padding: 6px 0;"><span style="background: ${color}15; color: ${color}; padding: 2px 10px; border-radius: 6px; font-weight: 600; text-transform: capitalize;">${taskPriority || 'medium'}</span></td>
          </tr>
          ${estimatedHours ? `<tr><td style="padding: 6px 0;"><strong>Est. Hours:</strong></td><td style="padding: 6px 0;">${estimatedHours}h</td></tr>` : ''}
          <tr>
            <td style="padding: 6px 0;"><strong>Assigned by:</strong></td>
            <td style="padding: 6px 0;">${managerName || 'Manager'}</td>
          </tr>
        </table>
      </div>
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 20px;">
        This is an automated notification from the VCC Timesheet App.
      </p>
    </div>
  `;

  try {
    await graphFetch(`/users/${senderEmail}/sendMail`, {
      method: 'POST',
      body: JSON.stringify({
        message: {
          subject: `New Task: ${taskTitle}`,
          body: { contentType: 'HTML', content: htmlBody },
          toRecipients: [{ emailAddress: { address: employeeEmail } }],
        },
      }),
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Task notification email error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
