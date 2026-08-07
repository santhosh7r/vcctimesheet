import { graphFetch } from '../_lib/graph-client.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    employeeName, employeeEmail, managerEmail, leaveType, startDate, endDate,
    daysCount, reason,
  } = req.body || {};

  if (!employeeName || !managerEmail || !startDate) {
    return res.status(400).json({ error: 'employeeName, managerEmail, and startDate are required' });
  }

  const senderEmail = process.env.AZURE_SENDER_EMAIL || 'sysadmin@d4insight.com';
  const sysadminEmail = 'sysadmin@d4insight.com';

  const typeLabels = {
    casual: 'Casual Leave', sick: 'Sick Leave', earned: 'Earned Leave',
    unpaid: 'Unpaid Leave', wfh: 'Work from Home', comp_off: 'Comp Off',
  };

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const htmlBody = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <div style="background: linear-gradient(135deg, #f59e0b, #d97706); border-radius: 12px; padding: 24px; margin-bottom: 20px;">
        <h2 style="color: #fff; margin: 0 0 4px;">Leave Request</h2>
        <p style="color: rgba(255,255,255,0.85); margin: 0; font-size: 14px;">${employeeName} has requested time off</p>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
        <table style="width: 100%; font-size: 14px; color: #475569;">
          <tr>
            <td style="padding: 8px 0; font-weight: 600; width: 130px;">Employee:</td>
            <td style="padding: 8px 0;">${employeeName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600;">Leave Type:</td>
            <td style="padding: 8px 0;">${typeLabels[leaveType] || leaveType}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600;">From:</td>
            <td style="padding: 8px 0;">${fmtDate(startDate)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600;">To:</td>
            <td style="padding: 8px 0;">${fmtDate(endDate || startDate)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600;">Days:</td>
            <td style="padding: 8px 0;">${daysCount || 1}</td>
          </tr>
          ${reason ? `<tr><td style="padding: 8px 0; font-weight: 600;">Reason:</td><td style="padding: 8px 0;">${reason}</td></tr>` : ''}
        </table>
      </div>
      <p style="color: #64748b; font-size: 13px; margin-top: 16px; text-align: center;">
        Please approve or reject this request from the <a href="https://vcc-timesheet-app.vercel.app" style="color: #4f46e5; text-decoration: none;">VCC Dashboard</a>.
      </p>
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 12px;">
        Automated notification from VCC Timesheet App
      </p>
    </div>
  `;

  try {
    const toRecipients = [{ emailAddress: { address: managerEmail } }];
    const ccRecipients = [];
    // CC sysadmin if manager is not sysadmin
    if (managerEmail !== sysadminEmail) {
      ccRecipients.push({ emailAddress: { address: sysadminEmail } });
    }
    // CC the employee too so they have a record
    if (employeeEmail && employeeEmail !== managerEmail) {
      ccRecipients.push({ emailAddress: { address: employeeEmail } });
    }

    const result = await graphFetch(`/users/${senderEmail}/sendMail`, {
      method: 'POST',
      body: JSON.stringify({
        message: {
          subject: `Leave Request: ${employeeName} - ${typeLabels[leaveType] || leaveType} (${fmtDate(startDate)}${startDate !== endDate ? ` to ${fmtDate(endDate)}` : ''})`,
          body: { contentType: 'HTML', content: htmlBody },
          toRecipients,
          ccRecipients: ccRecipients.length > 0 ? ccRecipients : undefined,
        },
      }),
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Leave request email error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
