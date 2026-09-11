import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatAPI } from '../lib/api'; 
import { useAuth } from '../hooks/useAuth';
import { Zap, ShieldAlert } from 'lucide-react';

export default function Upload() {
  const navigate = useNavigate();
  const { user } = useAuth() || {};

  // Dynamically enforce Pro Tier security configurations
  const userRole = user?.role || 'free';
  const isPremium = userRole === 'pro' || userRole === 'enterprise';

  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const fetchUploadedDocs = useCallback(async () => {
    if (!isPremium) return;
    try {
      const data = await chatAPI.getUploadedDocs();
      setFiles(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch inventory error:", err);
      setFiles([]);
    }
  }, [isPremium]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUploadedDocs();
  }, [fetchUploadedDocs]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (!isPremium) return;
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      await handleUpload(droppedFiles[0]);
    }
  };

  const handleFileChange = async (e) => {
    if (e.target.files.length > 0) {
      await handleUpload(e.target.files[0]);
    }
  };

  const handleUpload = async (file) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Unsupported file format. Only official regulatory PDF files are accepted.');
      return;
    }

    setUploading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await chatAPI.uploadDocument(formData);
      await fetchUploadedDocs();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error uploading file stream to core pipeline.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm("Confirm vector purge? This will permanently wipe text segments from ChromaDB.")) return;
    try {
      await chatAPI.deleteDocument(docId);
      setFiles(prev => prev.filter((file) => file.id !== docId));
    // eslint-disable-next-line no-unused-vars
    } catch (err) {
      setError('Failed to clear selected file reference elements.');
    }
  };

  // Professional Lock State
  if (!isPremium) {
    return (
      <div className="w-full min-h-[calc(100vh-53px)] bg-[#090d16] text-slate-200 flex flex-col items-center justify-center p-6">
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Private Document Ingestion</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Blended RAG allows querying internal company contracts, board resolutions, and tax assessment notices alongside verified Indian statutory circulars.
          </p>
          <div className="pt-2">
            <button 
              onClick={() => navigate('/pricing')}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-xs transition-colors shadow-sm"
            >
              <span>Upgrade to Pro Plan</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-10 text-slate-100 font-sans">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-mono font-semibold text-indigo-400 uppercase tracking-wider">
            Blended RAG Storage
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Document Repository
        </h1>
        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
          Upload internal agreements, tax notices, and corporate bylaws to query them alongside official statutory circulars.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Drag and Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border border-dashed rounded-2xl p-10 text-center transition-colors cursor-pointer ${
          isDragging 
            ? 'border-indigo-500 bg-indigo-950/20' 
            : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60'
        }`}
      >
        <input
          type="file"
          id="fileInput"
          className="hidden"
          accept=".pdf"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <label htmlFor="fileInput" className="cursor-pointer block">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className={`p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-indigo-400 ${uploading ? 'animate-spin' : ''}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200">
                {uploading ? 'Extracting text and generating vector embeddings...' : 'Click or drag compliance PDF documents here'}
              </p>
              <p className="text-xs text-slate-500 mt-1">PDF format supported up to 10MB</p>
            </div>
            {!uploading && (
              <span className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg shadow-sm transition-colors mt-2">
                Select File
              </span>
            )}
          </div>
        </label>
      </div>

      {/* Document Inventory Table */}
      <div className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold tracking-tight text-slate-200">Indexed Private Documents</h2>
          <span className="text-xs font-mono text-slate-400 px-2.5 py-0.5 bg-slate-900 border border-slate-800 rounded-md">
            {files.length} {files.length === 1 ? 'file' : 'files'}
          </span>
        </div>

        {files.length === 0 ? (
          <div className="text-center p-8 border border-slate-800/80 bg-slate-900/20 rounded-xl text-slate-500 text-xs">
            No private documents uploaded. Uploaded PDFs will be vectorized and indexed for hybrid retrieval.
          </div>
        ) : (
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-xs font-medium text-slate-400">
                  <th className="p-3.5 pl-5">Document Name</th>
                  <th className="p-3.5">Uploaded Date</th>
                  <th className="p-3.5 pr-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="p-3.5 pl-5 font-medium flex items-center space-x-2.5 truncate max-w-xs sm:max-w-md">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span className="truncate">{file.filename}</span>
                    </td>
                    <td className="p-3.5 text-slate-400 text-xs font-mono">
                      {new Date(file.uploaded_at).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
                      })}
                    </td>
                    <td className="p-3.5 pr-5 text-right">
                      <button
                        onClick={() => handleDelete(file.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-950/20 transition-colors"
                        title="Delete document"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}