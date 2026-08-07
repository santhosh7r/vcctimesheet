import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { renderTemplate, generatePdfFromHtml } from '../_lib/pdf-generator.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { templateId, userId, role, hourlyRate } = req.body || {};

  if (!templateId || !userId) {
    return res.status(400).json({ error: 'templateId and userId are required' });
  }

  try {
    // Get template
    const { data: template } = await supabaseAdmin
      .from('sop_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (!template) return res.status(404).json({ error: 'Template not found' });

    // Get user details
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Build variables
    const variables = {
      employee_name: user.name,
      employee_id: user.id,
      employee_email: user.email || '',
      project: user.project || '',
      role: role || user.designation || '',
      start_date: user.start_date || '',
      end_date: user.end_date || '',
      hourly_rate: hourlyRate || user.hourly_rate || 0,
    };

    // Render HTML
    const renderedHtml = renderTemplate(template.html_content, variables);

    // Create SOP document record
    const { data: sopDoc } = await supabaseAdmin
      .from('sop_documents')
      .insert({
        template_id: templateId,
        user_id: userId,
        role: role || user.designation,
        hourly_rate: hourlyRate || user.hourly_rate,
        rendered_html: renderedHtml,
        status: 'draft',
        created_by: req.body.createdBy || 'ADM001',
      })
      .select()
      .single();

    return res.status(200).json({
      success: true,
      sopDocument: sopDoc,
      renderedHtml,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
