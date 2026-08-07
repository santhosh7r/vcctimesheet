import { graphFetch } from '../_lib/graph-client.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    employeeName, employeeEmail, managerName, decision, leaveType,
    startDate, endDate, daysCount, reason,
  } = req.body || {};

  if (!employeeName || !employeeEmail || !decision) {
    return res.status(400).json({ error: 'employeeName, employeeEmail, and decision are required' });
  }

  const senderEmail = process.env.AZURE_SENDER_EMAIL || 'sysadmin@d4insight.com';

  const typeLabels = {
    casual: 'Casual Leave', sick: 'Sick Leave', earned: 'Earned Leave',
    unpaid: 'Unpaid Leave', wfh: 'Work from Home', comp_off: 'Comp Off',
  };

  const isApproved = decision === 'approved';
  const statusColor = isApproved ? '#10b981' : '#ef4444';
  const statusBg = isApproved ? '#ecfdf5' : '#fef2f2';
  const statusLabel = isApproved ? 'APPROVED' : 'REJECTED';
  const gradientFrom = isApproved ? '#10b981' : '#ef4444';
  const gradientTo = isApproved ? '#059669' : '#dc2626';

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const htmlBody = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
      <div style="background: linear-gradient(135deg, ${gradientFrom}, ${gradientTo}); border-radius: 12px; padding: 24px; margin-bottom: 20px;">
        <h2 style="color: #fff; margin: 0 0 4px;">Leave ${statusLabel}</h2>
        <p style="color: rgba(255,255,255,0.85); margin: 0; font-size: 14px;">Decision by ${managerName || 'Manager'}</p>
      </div>
      <div style="background: ${statusBg}; border: 1px solid ${statusColor}30; border-radius: 12px; padding: 16px; margin-bottom: 16px; text-align: center;">
        <span style="font-size: 18px; font-weight: 700; color: ${statusColor};">${statusLabel}</span>
      </div>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px;">
        <table style="width: 100%; font-size: 14px; color: #475569;">
          <tr>
            <td style="padding: 8px 0; font-weight: 600; width: 130px;">Employee:</td>
            <td style="padding: 8px 0;">${employeeName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600;">Leave Type:</td>
            <td style="padding: 8px 0;">${typeLabels[leaveType] || leaveType || 'N/A'}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600;">Dates:</td>
            <td style="padding: 8px 0;">${fmtDate(startDate)}${startDate !== endDate ? ` — ${fmtDate(endDate)}` : ''}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: 600;">Days:</td>
            <td style="padding: 8px 0;">${daysCount || 1}</td>
          </tr>
          ${reason ? `<tr><td style="padding: 8px 0; font-weight: 600;">Reason:</td><td style="padding: 8px 0;">${reason}</td></tr>` : ''}
          <tr>
            <td style="padding: 8px 0; font-weight: 600;">Decided by:</td>
            <td style="padding: 8px 0;">${managerName || 'Manager'}</td>
          </tr>
        </table>
      </div>
      <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 16px;">
        Automated notification from VCC Timesheet App
      </p>
    </div>
  `;

  try {
    // Send to employee, CC sysadmin
    const sysadminAddr = 'sysadmin@d4insight.com';
    const ccRecipients = [];
    if (employeeEmail !== sysadminAddr) {
      ccRecipients.push({ emailAddress: { address: sysadminAddr } });
    }

    await graphFetch(`/users/${senderEmail}/sendMail`, {
      method: 'POST',
      body: JSON.stringify({
        message: {
          subject: `Leave ${statusLabel}: ${employeeName} - ${typeLabels[leaveType] || leaveType} (${fmtDate(startDate)})`,
          body: { contentType: 'HTML', content: htmlBody },
          toRecipients: [{ emailAddress: { address: employeeEmail } }],
          ccRecipients: ccRecipients.length > 0 ? ccRecipients : undefined,
        },
      }),
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Leave decision email error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
