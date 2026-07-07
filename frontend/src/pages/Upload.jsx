import  { useState, useEffect, useCallback } from 'react';
import api from '../lib/api'; 

export default function Upload() {
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const fetchUploadedDocs = useCallback(async () => {
    try {
      const response = await api.get('/upload/list');
      setFiles(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error("Fetch error:", err);
      setFiles([]); // Fallback to empty state safely
    }
  }, []);

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
      await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchUploadedDocs();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error uploading file stream to core pipeline.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    try {
      await api.delete(`/upload/${docId}`);
      setFiles(prev => prev.filter((file) => file.id !== docId));
    // eslint-disable-next-line no-unused-vars
    } catch (err) {
      setError('Failed to clear selected file reference elements.');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto min-h-screen text-slate-100 font-sans">
      <div className="mb-8 mt-4">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-500 bg-clip-text text-transparent">
          Document Ingestion Workspace
        </h1>
        <p className="text-gray-400 text-sm mt-2">
          Blend your private corporate notices with official statutory corpora collections using dynamic localized vector parsing.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-red-300 text-sm backdrop-blur-sm">
          {error}
        </div>
      )}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border border-dashed rounded-2xl p-12 text-center transition-all duration-300 cursor-pointer ${
          isDragging 
            ? 'border-cyan-400 bg-cyan-950/20 shadow-[0_0_30px_rgba(34,211,238,0.15)]' 
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
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className={`p-4 rounded-full bg-slate-900/80 border border-slate-800 text-cyan-400 ${uploading ? 'animate-spin' : ''}`}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-200">
                {uploading ? 'Extracting Layout Text & Chunking Vectors...' : 'Drag and drop your regulatory compliance PDF'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Maximum asset scale up to 10MB file limitation</p>
            </div>
            {!uploading && (
              <span className="inline-block px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 text-slate-950 text-sm font-semibold rounded-xl shadow-md transition-all duration-200">
                Select PDF File
              </span>
            )}
          </div>
        </label>
      </div>

      <div className="mt-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold tracking-tight text-slate-300">Active Workspace Inventory</h2>
          <span className="text-xs font-semibold px-2.5 py-1 bg-slate-900/80 border border-slate-800 text-cyan-400 rounded-full">
            {files.length} {files.length === 1 ? 'Document' : 'Documents'} Loaded
          </span>
        </div>

        {files.length === 0 ? (
          <div className="text-center p-10 border border-slate-900 bg-slate-900/20 rounded-2xl text-slate-500 text-sm">
            No personal staging documents uploaded yet. High-tier items populate here upon generation.
          </div>
        ) : (
          <div className="bg-slate-900/30 border border-slate-900 rounded-2xl overflow-hidden backdrop-blur-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-900/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="p-4 pl-6">Isolated Asset Signature</th>
                  <th className="p-4">Sync Processing Timestamp</th>
                  <th className="p-4 pr-6 text-right">Purge Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-sm text-slate-300">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-slate-950/40 transition-colors duration-150">
                    <td className="p-4 pl-6 font-medium flex items-center space-x-3 truncate max-w-xs sm:max-w-md">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400/80 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span className="truncate">{file.filename}</span>
                    </td>
                    <td className="p-4 text-slate-400 text-xs font-mono">
                      {new Date(file.uploaded_at).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
                      })}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <button
                        onClick={() => handleDelete(file.id)}
                        className="text-slate-500 hover:text-red-400 p-2 hover:bg-red-950/20 rounded-xl transition-all duration-150"
                        title="Purge Vector Database Elements"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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