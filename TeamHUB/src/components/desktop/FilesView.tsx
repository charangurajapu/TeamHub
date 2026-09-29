import React, { useState, useRef, useEffect } from 'react';
import { WorkspaceFile, User, ViewMode } from '../../types';
import { WORKSPACE_FILES } from '../../data/mockData';
import { supabase, getLocalFiles, saveLocalFiles } from '../../lib/supabase';

interface FilesViewProps {
  currentUser: User;
  onNavigate: (view: ViewMode, itemId?: string) => void;
}

export const FilesView: React.FC<FilesViewProps> = ({ currentUser, onNavigate }) => {
  const [files, setFiles] = useState<WorkspaceFile[]>(() => {
    const loaded = getLocalFiles();
    return loaded.length > 0 ? loaded : WORKSPACE_FILES;
  });
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile>(() => {
    const loaded = getLocalFiles();
    return loaded.length > 0 ? loaded[0] : WORKSPACE_FILES[0];
  });
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [copiedShare, setCopiedShare] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadToast, setUploadToast] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync files from localStorage if modified externally (e.g. AI Doc preview save)
  useEffect(() => {
    const syncFiles = () => {
      const current = getLocalFiles();
      if (current.length > 0) {
        setFiles(current);
      }
    };

    window.addEventListener('storage', syncFiles);
    window.addEventListener('focus', syncFiles);
    return () => {
      window.removeEventListener('storage', syncFiles);
      window.removeEventListener('focus', syncFiles);
    };
  }, []);

  const handleDownloadFile = async (fileToDownload: WorkspaceFile) => {
    setUploadToast(`Preparing download for ${fileToDownload.name}...`);
    try {
      let downloadUrl = fileToDownload.url || fileToDownload.previewUrl;
      
      if (!downloadUrl) {
        const textContent =
          fileToDownload.content ||
          `TeamHUB Workspace Spec & Asset Document\n----------------------------------------\nFilename: ${fileToDownload.name}\nFolder: ${fileToDownload.folder}\nSize: ${fileToDownload.size}\nUploader: ${fileToDownload.uploader?.name || 'TeamHUB Member'}\nDate: ${fileToDownload.uploadedAt || 'Oct 24'}\nAI Summary: ${fileToDownload.aiSummary || 'Verified engineering specification asset.'}`;
        const blob = new Blob([textContent], {
          type: fileToDownload.type === 'md' ? 'text/markdown' : 'text/plain',
        });
        downloadUrl = URL.createObjectURL(blob);
      }

      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = fileToDownload.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => {
        setUploadToast(`Downloaded "${fileToDownload.name}" to your device!`);
        setTimeout(() => setUploadToast(null), 2500);
      }, 500);
    } catch (err) {
      setUploadToast(`Download error: Could not download ${fileToDownload.name}`);
    }
  };

  const handleUploadFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsUploading(true);

    const uploadedList: WorkspaceFile[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i];
      let publicUrl = '';

      if (supabase) {
        try {
          const filePath = `${currentUser.id}/${Date.now()}_${f.name}`;
          const { data, error } = await supabase.storage
            .from('files')
            .upload(filePath, f, { upsert: true });

          if (!error && data) {
            const { data: urlData } = supabase.storage
              .from('files')
              .getPublicUrl(data.path);
            publicUrl = urlData.publicUrl;
          }
        } catch (err) {
          console.warn('Supabase storage upload error, fallback to local URL:', err);
        }
      }

      const localBlobUrl = URL.createObjectURL(f);
      const ext = f.name.split('.').pop()?.toLowerCase() || 'file';
      const formattedSize =
        f.size > 1024 * 1024
          ? `${(f.size / (1024 * 1024)).toFixed(1)} MB`
          : `${Math.round(f.size / 1024)} KB`;

      const newFileObj: WorkspaceFile = {
        id: `file-${Date.now()}-${i}`,
        name: f.name,
        type: ext,
        size: formattedSize,
        folder: selectedFolder !== 'all' ? selectedFolder : 'Sprint Deliverables',
        uploadedAt: 'Just now',
        uploader: currentUser,
        previewUrl: f.type.startsWith('image/') ? (publicUrl || localBlobUrl) : undefined,
        url: publicUrl || localBlobUrl,
        tags: ['uploaded', ext],
      };

      uploadedList.push(newFileObj);
    }

    const updated = [...uploadedList, ...files];
    setFiles(updated);
    saveLocalFiles(updated);

    if (uploadedList.length > 0) {
      setSelectedFile(uploadedList[0]);
      setUploadToast(`Successfully uploaded ${uploadedList.length} file${uploadedList.length > 1 ? 's' : ''}!`);
      setTimeout(() => setUploadToast(null), 3000);
    }

    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const folders = [
    { name: 'Engineering Specs', count: files.filter(f => f.folder === 'Engineering Specs').length || 18, time: '2h ago', color: 'bg-[#ffdcc3]/60 text-[#b15f00]' },
    { name: 'Brand & Design Assets', count: files.filter(f => f.folder === 'Brand & Design Assets').length || 34, time: 'Yesterday', color: 'bg-[#dae2fd] text-[#0051d5]' },
    { name: 'Architecture RFCs', count: files.filter(f => f.folder === 'Architecture RFCs').length || 12, time: '3d ago', color: 'bg-[#7ffc97]/50 text-[#006b2c]' },
    { name: 'Sprint Deliverables', count: files.filter(f => f.folder === 'Sprint Deliverables').length || 27, time: 'Oct 24', color: 'bg-[#eaedff] text-[#3e4a3d]' },
  ];

  const filteredFiles = files.filter((f) => {
    if (selectedFolder !== 'all' && f.folder !== selectedFolder) return false;
    if (typeFilter !== 'all' && f.type !== typeFilter) return false;
    if (searchQuery) {
      return (
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.folder.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return true;
  });

  const handleCopyShare = () => {
    navigator.clipboard.writeText(`https://teamhub.internal/files/${selectedFile.id}`);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 1500);
  };

  return (
    <div className="flex flex-col w-full gap-6">
      {/* Sub-Header & Top Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-[#6e7b6c]">
            <span>Workspace</span>
            <span>/</span>
            <span className="text-[#131b2e] font-semibold">Files & Documents</span>
          </div>
          <h1 className="text-2xl font-bold text-[#131b2e] tracking-tight">Files & Documents</h1>
          <p className="text-xs text-[#6e7b6c]">
            Shared team assets, specifications, design systems, and meeting recordings.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Search */}
          <div className="relative flex items-center min-w-[220px]">
            <span className="material-symbols-outlined absolute left-3 text-[#6e7b6c] text-[18px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files or tags..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#ffffff] border border-[#eaedff] text-xs text-[#131b2e] placeholder:text-[#6e7b6c] focus:outline-none focus:ring-1 focus:ring-[#006b2c]"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-[#ffffff] border border-[#eaedff] text-xs font-medium text-[#131b2e] focus:outline-none cursor-pointer"
          >
            <option value="all">All types</option>
            <option value="md">Markdown RFCs (.md)</option>
            <option value="png">Images (.png)</option>
            <option value="pdf">Documents (.pdf)</option>
            <option value="json">Tokens (.json)</option>
            <option value="csv">Benchmarks (.csv)</option>
            <option value="mp4">Recordings (.mp4)</option>
          </select>

          {/* Grid / List switcher */}
          <div className="flex items-center bg-[#f2f3ff] p-1 rounded-xl">
            <button
              onClick={() => setViewLayout('grid')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewLayout === 'grid' ? 'bg-[#ffffff] text-[#006b2c] shadow-xs' : 'text-[#6e7b6c] hover:text-[#131b2e]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">grid_view</span>
            </button>
            <button
              onClick={() => setViewLayout('list')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                viewLayout === 'list' ? 'bg-[#ffffff] text-[#006b2c] shadow-xs' : 'text-[#6e7b6c] hover:text-[#131b2e]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">view_list</span>
            </button>
          </div>

          {/* Native Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleUploadFiles(e.target.files)}
            className="hidden"
            multiple
          />

          {/* Upload Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#006b2c] text-white text-xs font-semibold hover:bg-[#00873a] transition-all shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[18px] ${isUploading ? 'animate-spin' : ''}`}>
              {isUploading ? 'progress_activity' : 'cloud_upload'}
            </span>
            <span>{isUploading ? 'Uploading...' : 'Upload File'}</span>
          </button>
        </div>
      </div>

      {/* Upload Toast Alert */}
      {uploadToast && (
        <div className="p-3.5 rounded-2xl bg-[#006b2c] text-white text-xs font-semibold flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">cloud_done</span>
            <span>{uploadToast}</span>
          </div>
          <button onClick={() => setUploadToast(null)} className="text-white/80 hover:text-white cursor-pointer">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {/* Drag & Drop Upload Strip */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleUploadFiles(e.dataTransfer.files);
        }}
        className={`rounded-2xl p-4 transition-all duration-200 border ${
          isDragging
            ? 'bg-[#7ffc97]/20 border-[#006b2c] border-dashed ring-2 ring-[#006b2c]/30'
            : 'bg-[#f2f3ff] border-[#eaedff] shadow-xs'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
              isDragging ? 'bg-[#006b2c] text-white' : 'bg-[#7ffc97]/50 text-[#006b2c]'
            }`}>
              <span className="material-symbols-outlined text-[24px]">file_upload</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#131b2e]">
                  {isDragging ? 'Drop your files here to upload' : 'Drag and drop files here to upload'}
                </span>
                <span className="text-xs text-[#6e7b6c]">or browse your device</span>
              </div>
              <div className="flex items-center flex-wrap gap-1 mt-1 text-[10px]">
                {['PDF', 'PNG', 'FIG', 'MP4', 'MD'].map((ext) => (
                  <span key={ext} className="px-1.5 py-0.2 rounded bg-white text-[#3e4a3d] font-semibold border border-[#eaedff]">
                    {ext}
                  </span>
                ))}
                <span className="text-[#6e7b6c] ml-1">up to 250MB (Supabase Storage)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl bg-[#ffffff] hover:bg-[#eaedff] text-xs font-semibold text-[#131b2e] border border-[#eaedff] shadow-xs cursor-pointer"
            >
              Upload Folder
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-3.5 py-1.5 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">folder_open</span>
              <span>Browse Files</span>
            </button>
          </div>
        </div>
      </div>

      {/* Folders Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#131b2e]">Folders</span>
            <span className="text-[11px] px-2 py-0.2 rounded-full bg-[#eaedff] text-[#3e4a3d] font-semibold">
              4 Active
            </span>
            {selectedFolder !== 'all' && (
              <button
                onClick={() => setSelectedFolder('all')}
                className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#006b2c] text-white font-medium hover:bg-[#00873a] flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Filtered: {selectedFolder}</span>
                <span className="material-symbols-outlined text-[13px]">close</span>
              </button>
            )}
          </div>
          {selectedFolder !== 'all' && (
            <button
              onClick={() => setSelectedFolder('all')}
              className="text-xs text-[#006b2c] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Show all files</span>
              <span className="material-symbols-outlined text-[14px]">clear_all</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {folders.map((f, idx) => {
            const isFolderSelected = selectedFolder === f.name;
            return (
              <div
                key={idx}
                onClick={() => setSelectedFolder(isFolderSelected ? 'all' : f.name)}
                className={`p-4 rounded-2xl transition-all cursor-pointer flex flex-col justify-between group ${
                  isFolderSelected
                    ? 'bg-[#eaedff] border-2 border-[#006b2c] shadow-md ring-2 ring-[#006b2c]/20'
                    : 'bg-[#ffffff] border border-[#eaedff] shadow-xs hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${f.color} group-hover:scale-105 transition-transform`}>
                    <span className="material-symbols-outlined text-[20px]">folder</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFolder(isFolderSelected ? 'all' : f.name);
                    }}
                    className="text-[#6e7b6c] hover:text-[#131b2e] opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <span className="material-symbols-outlined text-[16px]">filter_alt</span>
                  </button>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[#131b2e] truncate group-hover:text-[#006b2c] transition-colors">
                    {f.name}
                  </span>
                  <span className="text-[10px] text-[#6e7b6c] mt-0.5">
                    {f.count} files • {f.time}
                  </span>
                </div>
              </div>
            );
          })}

          {/* New folder */}
          <button
            onClick={() => {
              fileInputRef.current?.click();
            }}
            className="p-4 rounded-2xl bg-[#f2f3ff] hover:bg-[#eaedff] border border-dashed border-[#bdcaba] text-[#3e4a3d] hover:text-[#006b2c] transition-colors flex flex-col items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">create_new_folder</span>
            <span className="text-xs font-bold">Upload Folder</span>
          </button>
        </div>
      </div>

      {/* Main Files Work Stage: Grid + Right Inspector Panel */}
      <div className="flex flex-col xl:flex-row gap-6 items-start">
        {/* Left: Files Grid Area */}
        <div className="flex-1 w-full min-w-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#131b2e]">Recent Files</span>
              <span className="text-xs text-[#6e7b6c]">({filteredFiles.length})</span>
            </div>
            <span className="text-xs text-[#6e7b6c]">Sort: Last modified</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFiles.map((file) => {
              const isSelected = selectedFile.id === file.id;
              return (
                <div
                  key={file.id}
                  onClick={() => setSelectedFile(file)}
                  className={`p-4 rounded-2xl bg-[#ffffff] transition-all cursor-pointer flex flex-col justify-between group border relative ${
                    isSelected
                      ? 'border-[#006b2c] shadow-md ring-2 ring-[#006b2c]/20'
                      : 'border-[#eaedff] shadow-xs hover:shadow-md'
                  }`}
                >
                  <div>
                    {/* Thumbnail preview banner */}
                    <div className="relative w-full h-28 rounded-xl bg-[#f2f3ff] overflow-hidden mb-3 flex items-center justify-center border border-[#eaedff]">
                      {file.type === 'md' ? (
                        <div className="flex flex-col items-center justify-center gap-1.5 text-[#006b2c]">
                          <div className="w-10 h-10 rounded-xl bg-[#7ffc97]/40 flex items-center justify-center text-[#006b2c]">
                            <span className="material-symbols-outlined text-[24px]">description</span>
                          </div>
                          <span className="text-[10px] font-mono font-semibold text-[#005320] bg-[#7ffc97]/50 px-2 py-0.5 rounded-full">
                            Markdown RFC
                          </span>
                        </div>
                      ) : file.type === 'png' ? (
                        <svg className="w-4/5 h-16 text-[#006b2c]/70" fill="none" viewBox="0 0 160 80">
                          <rect fill="currentColor" fillOpacity="0.2" height="14" rx="3" width="30" x="10" y="10" />
                          <rect fill="currentColor" fillOpacity="0.4" height="14" rx="3" width="30" x="65" y="10" />
                          <rect fill="currentColor" fillOpacity="0.2" height="14" rx="3" width="30" x="120" y="10" />
                          <line stroke="currentColor" strokeDasharray="2 2" strokeWidth="1.5" x1="25" x2="25" y1="24" y2="70" />
                          <line stroke="currentColor" strokeDasharray="2 2" strokeWidth="1.5" x1="80" x2="80" y1="24" y2="70" />
                          <line stroke="currentColor" strokeDasharray="2 2" strokeWidth="1.5" x1="135" x2="135" y1="24" y2="70" />
                          <path d="M25 35H78" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M80 48H133" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      ) : file.type === 'pdf' ? (
                        <span className="material-symbols-outlined text-[36px] text-[#ba1a1a]">picture_as_pdf</span>
                      ) : file.type === 'json' ? (
                        <span className="material-symbols-outlined text-[36px] text-[#8d4b00]">data_object</span>
                      ) : file.type === 'csv' ? (
                        <span className="material-symbols-outlined text-[36px] text-[#006b2c]">table_chart</span>
                      ) : (
                        <span className="material-symbols-outlined text-[36px] text-[#0051d5]">videocam</span>
                      )}

                      <span className="absolute top-2 right-2 px-1.5 py-0.2 rounded-full bg-white/90 text-[10px] font-bold text-[#131b2e] shadow-2xs uppercase">
                        {file.type}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-[#131b2e] truncate group-hover:text-[#006b2c] transition-colors">
                            {file.name}
                          </h4>
                          <span className="text-[10px] text-[#6e7b6c]">{file.size}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Metadata */}
                  <div className="flex items-center justify-between pt-2.5 mt-3 border-t border-[#eaedff] text-[10px] text-[#6e7b6c]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-[#eaedff] text-[#006b2c] font-bold text-[9px] flex items-center justify-center">
                        {file.uploader.initials}
                      </div>
                      <span className="truncate max-w-[80px]">{file.uploader.name}</span>
                    </div>
                    <span>{file.uploadedAt.split('•')[0]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Persistent File Inspector Panel (Screen 5 right panel) */}
        <div className="w-full xl:w-[380px] shrink-0 rounded-2xl bg-[#ffffff] border border-[#eaedff] shadow-sm p-5 flex flex-col gap-4 sticky top-20">
          <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#eaedff]">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full bg-[#7ffc97]/40 text-[#005320] text-[10px] font-bold uppercase">
                  {selectedFile.type}
                </span>
                <span className="text-[11px] text-[#6e7b6c]">{selectedFile.size}</span>
              </div>
              <h3 className="text-sm font-bold text-[#131b2e] truncate" title={selectedFile.name}>
                {selectedFile.name}
              </h3>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleCopyShare}
                className="p-1.5 rounded-lg text-[#6e7b6c] hover:bg-[#f2f3ff] transition-colors cursor-pointer"
                title="Share link"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {copiedShare ? 'check' : 'share'}
                </span>
              </button>
            </div>
          </div>

          {/* Visual Preview Stage */}
          <div className="relative w-full h-44 rounded-xl bg-[#f2f3ff] border border-[#eaedff] overflow-hidden flex flex-col justify-between p-3 group shadow-inner">
            <div className="flex items-center justify-between text-[11px] z-10">
              <span className="px-2 py-0.5 rounded bg-white text-[10px] font-mono text-[#6e7b6c]">
                {selectedFile.type === 'md' ? 'Markdown Document' : (selectedFile.dimensions || '2400 × 1600 px')}
              </span>
              <div className="flex items-center gap-1 bg-white/90 backdrop-blur rounded-lg p-0.5">
                <button
                  onClick={() => setZoomLevel(Math.min(150, zoomLevel + 10))}
                  className="p-1 text-[#6e7b6c] hover:text-[#131b2e] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px]">zoom_in</span>
                </button>
                <button
                  onClick={() => setZoomLevel(Math.max(80, zoomLevel - 10))}
                  className="p-1 text-[#6e7b6c] hover:text-[#131b2e] cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[13px]">zoom_out</span>
                </button>
              </div>
            </div>

            {selectedFile.type === 'md' && selectedFile.content ? (
              <div className="w-full h-24 overflow-y-auto p-2.5 text-[11px] text-[#131b2e] font-mono leading-relaxed bg-[#ffffff] rounded-lg border border-[#eaedff] shadow-xs my-auto">
                <pre className="whitespace-pre-wrap font-sans text-xs text-[#131b2e]">{selectedFile.content.slice(0, 320)}...</pre>
              </div>
            ) : (
              /* Simulated diagram preview */
              <div
                className="flex items-center justify-around my-auto w-full transition-transform duration-100"
                style={{ transform: `scale(${zoomLevel / 100})` }}
              >
                <div className="flex flex-col items-center">
                  <div className="w-12 h-6 rounded bg-white shadow-xs flex items-center justify-center text-[10px] font-bold text-[#131b2e]">
                    Client
                  </div>
                  <div className="h-6 border-l border-dashed border-[#bdcaba] mt-0.5"></div>
                </div>
                <span className="material-symbols-outlined text-[#006b2c] text-[16px]">trending_flat</span>
                <div className="flex flex-col items-center">
                  <div className="w-14 h-6 rounded bg-[#7ffc97] text-[#002109] shadow-xs flex items-center justify-center text-[10px] font-bold">
                    Gateway
                  </div>
                  <div className="h-6 border-l border-dashed border-[#006b2c] mt-0.5"></div>
                </div>
                <span className="material-symbols-outlined text-[#6e7b6c] text-[16px]">trending_flat</span>
                <div className="flex flex-col items-center">
                  <div className="w-12 h-6 rounded bg-white shadow-xs flex items-center justify-center text-[10px] font-bold text-[#131b2e]">
                    Redis
                  </div>
                  <div className="h-6 border-l border-dashed border-[#bdcaba] mt-0.5"></div>
                </div>
              </div>
            )}

            <button
              onClick={() => handleDownloadFile(selectedFile)}
              className="self-center flex items-center gap-1 px-3 py-1 rounded-full bg-white/90 text-[#131b2e] text-[10px] font-semibold shadow-xs hover:bg-white transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[13px]">visibility</span>
              <span>{selectedFile.type === 'md' ? 'Download Markdown' : 'Open full preview'}</span>
            </button>
          </div>

          {/* AI File Summary */}
          <div className="p-3 rounded-xl bg-[#7ffc97]/20 border border-[#7ffc97]/30 flex flex-col gap-1 text-xs">
            <div className="flex items-center gap-1.5 text-[#006b2c] font-bold text-[11px]">
              <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
              <span>TeamHub AI File Summary</span>
            </div>
            <p className="text-xs text-[#131b2e] leading-relaxed">
              {selectedFile.aiSummary ||
                'Contains sequence flow of OAuth2 token exchange with sliding-window Redis cache fallback and TTL renewal steps.'}
            </p>
          </div>

          {/* Properties */}
          <div className="space-y-2 text-xs">
            <span className="text-[10px] uppercase font-bold text-[#6e7b6c] tracking-wider block">
              Properties
            </span>
            <div className="flex items-center justify-between text-[#3e4a3d]">
              <span className="text-[#6e7b6c]">File Type</span>
              <span className="font-semibold uppercase">{selectedFile.type}</span>
            </div>
            <div className="flex items-center justify-between text-[#3e4a3d]">
              <span className="text-[#6e7b6c]">Size</span>
              <span>{selectedFile.size}</span>
            </div>
            <div className="flex items-center justify-between text-[#3e4a3d]">
              <span className="text-[#6e7b6c]">Uploaded By</span>
              <span className="font-semibold text-[#131b2e]">{selectedFile.uploader.name}</span>
            </div>
            <div className="flex items-center justify-between text-[#3e4a3d]">
              <span className="text-[#6e7b6c]">Location</span>
              <span className="text-[#006b2c] font-semibold truncate max-w-[180px]">
                / {selectedFile.folder}
              </span>
            </div>
          </div>

          {/* Linked References */}
          {selectedFile.linkedTask && (
            <div className="space-y-1.5 pt-2 border-t border-[#eaedff]">
              <span className="text-[10px] uppercase font-bold text-[#6e7b6c] tracking-wider block">
                Linked References
              </span>
              <button
                onClick={() => onNavigate('tasks')}
                className="w-full text-left p-2 rounded-xl bg-[#f2f3ff] hover:bg-[#eaedff] flex items-center gap-2 text-xs text-[#131b2e] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] text-[#006b2c]">task_alt</span>
                <span className="truncate">{selectedFile.linkedTask}</span>
              </button>
            </div>
          )}

          {/* Panel Action CTAs */}
          <div className="flex flex-col gap-2 pt-2 mt-auto">
            <button
              onClick={() => handleDownloadFile(selectedFile)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold transition-colors shadow-xs cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-[17px]">download</span>
              <span>Download ({selectedFile.size})</span>
            </button>
            <button
              onClick={handleCopyShare}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#f2f3ff] hover:bg-[#eaedff] text-xs font-semibold text-[#131b2e] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[17px] text-[#6e7b6c]">link</span>
              <span>{copiedShare ? 'Link Copied!' : 'Copy Share Link'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
