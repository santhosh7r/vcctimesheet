import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, FileCheck, Briefcase, ScrollText } from 'lucide-react';
import { api, supabase, useSupabase } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';

const docTypeConfig = {
  sow: { label: 'SOW', gradient: 'from-blue-500 to-indigo-500', icon: ScrollText },
  offer_letter: { label: 'Offer Letter', gradient: 'from-emerald-500 to-teal-500', icon: FileCheck },
  contract: { label: 'Contract', gradient: 'from-violet-500 to-purple-500', icon: Briefcase },
  other: { label: 'Other', gradient: 'from-slate-400 to-slate-500', icon: FileText },
};

export default function MyDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/documents?userId=${user.id}`)
      .then(data => setDocuments(data.documents || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user.id]);

  const handleDownload = async (doc) => {
    try {
      if (useSupabase && supabase && doc.storage_path) {
        const { data, error } = await supabase.storage
          .from('documents')
          .download(doc.storage_path);
        if (error) throw error;
        const url = URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.original_name;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        alert(`Demo mode: Download of "${doc.original_name}" is simulated.`);
      }
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="My Documents" subtitle="View and download your employment documents" icon={FileText} />
      <Card animate delay={0.1}>
        {documents.length === 0 ? (
          <EmptyState icon={FileText} title="No documents yet" description="Your SOW, offer letters, and contracts will appear here once uploaded by admin." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-3.5 px-6 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="text-left py-3.5 px-6 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">File Name</th>
                  <th className="text-left py-3.5 px-6 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Upload Date</th>
                  <th className="text-right py-3.5 px-6 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc, i) => {
                  const config = docTypeConfig[doc.doc_type] || docTypeConfig.other;
                  return (
                    <motion.tr key={doc.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors duration-200">
                      <td className="py-3.5 px-6">
                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-semibold text-white bg-gradient-to-r ${config.gradient}`}>
                          <config.icon size={14} /> {config.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-[13px] text-slate-700 font-medium">{doc.original_name}</td>
                      <td className="py-3.5 px-6 text-[12px] text-slate-400">
                        {new Date(doc.uploaded_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <button onClick={() => handleDownload(doc)}
                          className="inline-flex items-center gap-2 px-4 py-2 text-[12px] font-semibold text-primary-600 hover:bg-primary-50 rounded-xl transition-all duration-200 border border-transparent hover:border-primary-200">
                          <Download size={14} /> Download
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
