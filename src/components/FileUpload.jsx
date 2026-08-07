import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, File, X } from 'lucide-react';

export default function FileUpload({ onFileSelect, accept, label = 'Upload Document' }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      onFileSelect?.(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    if (e.target.files?.[0]) {
      setSelectedFile(e.target.files[0]);
      onFileSelect?.(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    onFileSelect?.(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <label className="block text-[12px] font-semibold text-slate-600 mb-2 uppercase tracking-wider">{label}</label>
      <motion.div
        whileHover={{ scale: 1.005 }}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-250 cursor-pointer ${
          dragActive
            ? 'border-primary-400 bg-primary-50/50 shadow-[0_0_0_4px_rgba(99,102,241,0.08)]'
            : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50/50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept={accept} onChange={handleChange} className="hidden" />
        {selectedFile ? (
          <div className="flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
              <File size={20} className="text-primary-600" />
            </div>
            <span className="text-[13px] font-medium text-slate-700">{selectedFile.name}</span>
            <button onClick={(e) => { e.stopPropagation(); clearFile(); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-100 transition-colors">
              <X size={16} className="text-slate-400" />
            </button>
          </div>
        ) : (
          <div>
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Upload size={22} className="text-slate-400" strokeWidth={1.8} />
            </div>
            <p className="text-[13px] font-medium text-slate-600">Drag & drop or click to upload</p>
            <p className="text-[11px] text-slate-400 mt-1">PDF, DOC, DOCX up to 10MB</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
