import React, { useState, useRef } from 'react';
import { User } from '../../types';
import { uploadAvatarToSupabase, deleteAvatarFromSupabase, validateAvatarFile } from '../../lib/supabase';

interface PhotoCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onSavePhoto: (photoUrl: string) => void;
  onRemovePhoto: () => void;
}

export const PhotoCropModal: React.FC<PhotoCropModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSavePhoto,
  onRemovePhoto,
}) => {
  const [modalState, setModalState] = useState<'upload' | 'crop' | 'error' | 'initials'>('crop');
  const [zoom, setZoom] = useState(120);
  const [rotation, setRotation] = useState(0);
  const [initialsColor, setInitialsColor] = useState('emerald');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>(
    currentUser.avatarUrl ||
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDckxFNH4tuhFevNplIESQsVgeppp5-kahfIhAjXSGiZ_YfD34-7G4s2OfmhPBV9k01hl6h_YmVI5bWBAbKSLDnySBQbub6IdSxE0zCCxltCMhK_MDGzNZswXuNyauovKbXAU4_I5LYo4C3ehzkAdcZRmwu2uHLusWgi3_0ok6xbk7iE4CKda3wjDUK0ouEdZAgyxt88Zx79ngiR57mN7T-fEt2jWzfO1Ur4OPHaEvsDuxhJZrji8v1sg'
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    processSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const processSelectedFile = (file: File) => {
    const validation = validateAvatarFile(file);
    if (!validation.valid) {
      setValidationError(validation.error || 'Invalid file.');
      setSelectedFile(file);
      setModalState('error');
      return;
    }

    setValidationError(null);
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setImagePreviewUrl(objectUrl);
    setZoom(100);
    setRotation(0);
    setModalState('crop');
  };

  const handleSaveCropped = async () => {
    setIsUploading(true);

    try {
      let fileToUpload = selectedFile;

      // If no new file was browsed, create a blob from the current image preview
      if (!fileToUpload) {
        // Convert current image/canvas to a File
        const res = await fetch(imagePreviewUrl);
        const blob = await res.blob();
        fileToUpload = new File([blob], `avatar_${currentUser.id}.png`, { type: 'image/png' });
      }

      // Upload to Supabase Storage "avatars" bucket with RLS verification
      const uploadRes = await uploadAvatarToSupabase(currentUser.id, fileToUpload, currentUser);

      if (uploadRes.error) {
        setValidationError(uploadRes.error);
        setModalState('error');
        setIsUploading(false);
        return;
      }

      setToastMessage('Profile photo successfully uploaded to avatars bucket!');
      setShowToast(true);
      onSavePhoto(uploadRes.url);

      setTimeout(() => {
        setShowToast(false);
        setIsUploading(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      setValidationError(err.message || 'Failed to upload photo.');
      setModalState('error');
      setIsUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    setIsUploading(true);
    await deleteAvatarFromSupabase(currentUser.id, currentUser);
    onRemovePhoto();
    setToastMessage('Profile photo removed. Initial fallback restored.');
    setShowToast(true);
    setIsUploading(false);
    setTimeout(() => {
      setShowToast(false);
      onClose();
    }, 1000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#131b2e]/40 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[560px] bg-[#ffffff] rounded-2xl shadow-2xl overflow-hidden border border-[#eaedff]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Decorative Gradient Accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#006b2c] via-[#00873a] to-[#0051d5]"></div>

        {/* Modal Header */}
        <div className="px-6 pt-5 pb-3 flex items-start justify-between">
          <div className="flex flex-col pr-4">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-[#131b2e] tracking-tight">Update Profile Photo</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#eaedff] text-[11px] font-semibold text-[#3e4a3d]">
                Core Pod
              </span>
            </div>
            <p className="text-xs text-[#3e4a3d] mt-1">
              JPG or PNG only, max 2 MB. Uploads securely to Supabase Storage in the <code className="bg-[#f2f3ff] px-1 py-0.5 rounded text-[#006b2c] font-mono">avatars</code> bucket.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6e7b6c] hover:text-[#131b2e] hover:bg-[#eaedff] transition-colors shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* State Switcher Navigation Bar */}
        <div className="px-6 pb-2">
          <div className="flex items-center gap-1 p-1 bg-[#f2f3ff] rounded-xl text-xs font-semibold">
            <button
              onClick={() => setModalState('upload')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                modalState === 'upload' ? 'bg-[#ffffff] text-[#006b2c] shadow-xs' : 'text-[#6e7b6c] hover:text-[#131b2e]'
              }`}
            >
              1. Upload
            </button>
            <button
              onClick={() => setModalState('crop')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                modalState === 'crop' ? 'bg-[#006b2c] text-white shadow-xs' : 'text-[#6e7b6c] hover:text-[#131b2e]'
              }`}
            >
              2. Crop & Adjust
            </button>
            <button
              onClick={() => setModalState('error')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                modalState === 'error' ? 'bg-[#ffffff] text-[#ba1a1a] shadow-xs' : 'text-[#6e7b6c] hover:text-[#131b2e]'
              }`}
            >
              3. Validation Error
            </button>
            <button
              onClick={() => setModalState('initials')}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                modalState === 'initials' ? 'bg-[#ffffff] text-[#006b2c] shadow-xs' : 'text-[#6e7b6c] hover:text-[#131b2e]'
              }`}
            >
              4. Initials Fallback
            </button>
          </div>
        </div>

        {/* Hidden Real File Input (Accepts JPG/PNG only) */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/png,image/jpeg,image/jpg"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* STATE 1: UPLOAD */}
        {modalState === 'upload' && (
          <div className="p-6 pt-2 flex flex-col">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="p-8 rounded-2xl bg-[#f2f3ff] border-2 border-dashed border-[#bdcaba] hover:border-[#006b2c] flex flex-col items-center text-center cursor-pointer transition-colors group"
            >
              <div className="w-14 h-14 rounded-full bg-[#7ffc97]/50 flex items-center justify-center text-[#006b2c] mb-3 group-hover:scale-105 transition-transform">
                <span className="material-symbols-outlined text-[28px]">cloud_upload</span>
              </div>
              <div className="text-sm font-semibold text-[#131b2e] mb-1">
                Drag your photo here or <span className="text-[#006b2c] underline">browse files</span>
              </div>
              <p className="text-xs text-[#6e7b6c] max-w-xs">
                Supports <strong>JPG or PNG only</strong> up to <strong>2.0 MB</strong>. Minimum 200×200px recommended.
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ffffff] text-xs font-semibold text-[#131b2e] shadow-xs border border-[#eaedff]">
                <span className="material-symbols-outlined text-[16px] text-[#6e7b6c]">file_upload</span>
                <span>Choose JPG or PNG</span>
              </div>
            </div>

            {/* Current Active Avatar Info Card */}
            <div className="mt-4 p-3 rounded-xl bg-[#eaedff] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full overflow-hidden shadow-xs shrink-0 bg-white">
                  {currentUser.avatarUrl ? (
                    <img
                      className="w-full h-full object-cover"
                      src={currentUser.avatarUrl}
                      alt="Current avatar"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-xs text-[#006b2c]">
                      {currentUser.initials}
                    </div>
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-[#131b2e] truncate">
                    {currentUser.avatarUrl ? 'avatar-profile.png' : 'Initials fallback'}
                  </span>
                  <span className="text-[10px] text-[#6e7b6c]">
                    {currentUser.avatarUrl ? 'Active custom photo' : 'No photo uploaded'}
                  </span>
                </div>
              </div>
              {currentUser.avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="text-xs font-semibold text-[#ba1a1a] hover:underline cursor-pointer"
                >
                  Remove photo
                </button>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#3e4a3d] hover:bg-[#eaedff] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setModalState('crop')}
                className="px-5 py-2 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <span>Continue to Crop</span>
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </div>
        )}

        {/* STATE 2: CROP & ADJUST */}
        {modalState === 'crop' && (
          <div className="p-6 pt-2 flex flex-col">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Interactive Circular Crop Circle Viewport */}
              <div className="flex flex-col items-center justify-center shrink-0">
                <div className="relative w-48 h-48 rounded-full overflow-hidden bg-[#eaedff] shadow-inner flex items-center justify-center select-none group border-2 border-[#006b2c]">
                  {/* Grid Guides for Composition */}
                  <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-30 z-10">
                    <div className="border-b border-r border-white"></div>
                    <div className="border-b border-r border-white"></div>
                    <div className="border-b border-white"></div>
                    <div className="border-b border-r border-white"></div>
                    <div className="border-b border-r border-white"></div>
                    <div className="border-b border-white"></div>
                    <div className="border-r border-white"></div>
                    <div className="border-r border-white"></div>
                    <div></div>
                  </div>

                  {/* Zoomed Subject Image */}
                  <div className="w-full h-full flex items-center justify-center cursor-grab active:cursor-grabbing">
                    <img
                      className="w-56 h-56 max-w-none object-cover pointer-events-none transition-transform duration-75"
                      style={{
                        transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                      }}
                      src={imagePreviewUrl}
                      alt="Crop target"
                    />
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-[#6e7b6c] flex items-center gap-1 font-medium">
                  <span className="material-symbols-outlined text-[14px]">center_focus_strong</span>
                  <span>1:1 Circular Crop Preview</span>
                </div>
              </div>

              {/* Adjustments & Live In-Context Previews */}
              <div className="flex-1 w-full flex flex-col justify-between">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-[#6e7b6c] font-semibold">
                    Live Workspace Context Previews
                  </span>
                  <div className="mt-1.5 p-3 rounded-xl bg-[#f2f3ff] flex items-center gap-6">
                    {/* Chat bar (36px) */}
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-full overflow-hidden shadow-xs shrink-0 bg-white">
                        <img
                          className="w-full h-full object-cover"
                          style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)` }}
                          src={imagePreviewUrl}
                          alt="Chat 36px"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-[#131b2e] leading-none">Top Bar</span>
                        <span className="text-[10px] text-[#6e7b6c]">36×36px</span>
                      </div>
                    </div>

                    <div className="w-px h-8 bg-[#eaedff]"></div>

                    {/* Task chip (24px) */}
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full overflow-hidden shadow-xs shrink-0 bg-white">
                        <img
                          className="w-full h-full object-cover"
                          style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)` }}
                          src={imagePreviewUrl}
                          alt="Task 24px"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-[#131b2e] leading-none">Task Chip</span>
                        <span className="text-[10px] text-[#6e7b6c]">24×24px</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Zoom Control Slider */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-1 text-xs">
                    <span className="font-medium text-[#131b2e]">Zoom Level</span>
                    <span className="font-semibold text-[#006b2c]">{zoom}%</span>
                  </div>
                  <div className="flex items-center gap-2 bg-[#f2f3ff] px-3 py-1.5 rounded-lg border border-[#eaedff]">
                    <button
                      type="button"
                      onClick={() => setZoom(Math.max(100, zoom - 10))}
                      className="text-[#6e7b6c] hover:text-[#131b2e] cursor-pointer"
                      title="Zoom out"
                    >
                      <span className="material-symbols-outlined text-[18px]">zoom_out</span>
                    </button>
                    <input
                      type="range"
                      min="100"
                      max="200"
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full accent-[#006b2c] h-1.5 bg-[#dae2fd] rounded-lg cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => setZoom(Math.min(200, zoom + 10))}
                      className="text-[#6e7b6c] hover:text-[#131b2e] cursor-pointer"
                      title="Zoom in"
                    >
                      <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                    </button>
                  </div>
                </div>

                {/* Transform Shortcut Buttons */}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRotation((rotation - 90) % 360)}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-[#f2f3ff] hover:bg-[#eaedff] text-xs font-medium text-[#131b2e] flex items-center justify-center gap-1 transition-colors cursor-pointer border border-[#eaedff]"
                  >
                    <span className="material-symbols-outlined text-[16px]">rotate_left</span>
                    <span>Rotate 90°</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setZoom(100);
                      setRotation(0);
                    }}
                    className="flex-1 py-1.5 px-2 rounded-lg bg-[#f2f3ff] hover:bg-[#eaedff] text-xs font-medium text-[#131b2e] flex items-center justify-center gap-1 transition-colors cursor-pointer border border-[#eaedff]"
                  >
                    <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                    <span>Recenter</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Control Bar */}
            <div className="mt-6 pt-4 border-t border-[#eaedff] flex items-center justify-between">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-[#006b2c] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                <span>Choose different file</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#3e4a3d] hover:bg-[#eaedff] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveCropped}
                  disabled={isUploading}
                  className="px-5 py-2 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {isUploading ? 'sync' : 'cloud_upload'}
                  </span>
                  <span>{isUploading ? 'Uploading to Supabase...' : 'Save & Upload'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STATE 3: VALIDATION ERROR STATE */}
        {modalState === 'error' && (
          <div className="p-6 pt-2 flex flex-col">
            <div className="p-4 rounded-xl bg-[#ffdad6] text-[#93000a] flex items-start gap-3 border border-[#ba1a1a]/30">
              <span className="material-symbols-outlined text-[22px] text-[#ba1a1a] shrink-0 mt-0.5">warning</span>
              <div>
                <h3 className="text-xs font-bold">Client-Side Validation Failed</h3>
                <p className="text-xs mt-0.5 leading-relaxed font-medium">
                  {validationError || 'The selected file could not be processed. Only JPG or PNG files up to 2.0 MB are accepted.'}
                </p>
              </div>
            </div>

            {selectedFile && (
              <div className="mt-4 p-3.5 rounded-xl bg-[#f2f3ff] flex items-center justify-between border border-[#eaedff]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#eaedff] flex items-center justify-center text-[#ba1a1a]">
                    <span className="material-symbols-outlined text-[22px]">description</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-[#131b2e] truncate max-w-xs">{selectedFile.name}</span>
                    <span className="text-[11px] text-[#ba1a1a]">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || 'Unknown format'}
                    </span>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[#6e7b6c] text-[18px]">close</span>
              </div>
            )}

            <div className="mt-4 p-3.5 rounded-xl bg-[#eaedff] text-xs space-y-1.5">
              <span className="text-[11px] uppercase tracking-wider text-[#6e7b6c] font-bold block mb-1">
                Photo Requirements Checklist
              </span>
              <div className="flex items-center gap-2 text-[#3e4a3d]">
                <span className="material-symbols-outlined text-[#006b2c] text-[16px]">check_circle</span>
                <span>Accepted formats: <strong>JPG or PNG only</strong> (GIF, SVG, WebP, PDF not accepted)</span>
              </div>
              <div className="flex items-center gap-2 text-[#3e4a3d]">
                <span className="material-symbols-outlined text-[#006b2c] text-[16px]">check_circle</span>
                <span>Maximum file size: <strong>2.0 MB or smaller</strong></span>
              </div>
              <div className="flex items-center gap-2 text-[#3e4a3d]">
                <span className="material-symbols-outlined text-[#006b2c] text-[16px]">check_circle</span>
                <span>Target: Supabase Storage <code className="bg-white px-1 py-0.5 rounded font-mono">avatars</code> bucket</span>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalState('crop')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#3e4a3d] hover:bg-[#eaedff] transition-colors cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2 rounded-xl bg-[#006b2c] hover:bg-[#00873a] text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                <span>Select Valid File</span>
              </button>
            </div>
          </div>
        )}

        {/* STATE 4: INITIALS FALLBACK */}
        {modalState === 'initials' && (
          <div className="p-6 pt-2 flex flex-col">
            <div className="flex flex-col items-center text-center">
              <div
                className={`w-28 h-28 rounded-full flex items-center justify-center text-white text-3xl font-bold tracking-tight shadow-md transition-colors ${
                  initialsColor === 'emerald'
                    ? 'bg-gradient-to-br from-[#7ffc97] to-[#00873a]'
                    : initialsColor === 'secondary'
                    ? 'bg-gradient-to-br from-[#dbe1ff] to-[#0051d5]'
                    : initialsColor === 'tertiary'
                    ? 'bg-gradient-to-br from-[#ffdcc3] to-[#8d4b00]'
                    : 'bg-[#283044]'
                }`}
              >
                {currentUser.initials}
              </div>
              <div className="mt-3 flex flex-col items-center">
                <span className="text-base font-semibold text-[#131b2e]">{currentUser.name}</span>
                <span className="text-xs text-[#6e7b6c]">{currentUser.roleTitle}</span>
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f2f3ff] text-[11px] text-[#3e4a3d] border border-[#eaedff]">
                <span className="material-symbols-outlined text-[#006b2c] text-[15px]">verified</span>
                <span>Initials fallback avatar displayed when no photo is set</span>
              </div>
            </div>

            {/* Initials Color Picker */}
            <div className="mt-5 p-3.5 rounded-xl bg-[#f2f3ff] border border-[#eaedff]">
              <div className="flex items-center justify-between mb-2 text-xs">
                <span className="font-semibold text-[#131b2e]">Initials Palette Theme</span>
                <span className="font-medium text-[#006b2c] capitalize">{initialsColor} Palette</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setInitialsColor('emerald')}
                  className={`w-8 h-8 rounded-full bg-[#006b2c] transition-transform cursor-pointer ${
                    initialsColor === 'emerald' ? 'ring-2 ring-offset-2 ring-[#006b2c] scale-110' : ''
                  }`}
                  title="Emerald Green"
                />
                <button
                  type="button"
                  onClick={() => setInitialsColor('secondary')}
                  className={`w-8 h-8 rounded-full bg-[#0051d5] transition-transform cursor-pointer ${
                    initialsColor === 'secondary' ? 'ring-2 ring-offset-2 ring-[#0051d5] scale-110' : ''
                  }`}
                  title="Calm Indigo"
                />
                <button
                  type="button"
                  onClick={() => setInitialsColor('tertiary')}
                  className={`w-8 h-8 rounded-full bg-[#8d4b00] transition-transform cursor-pointer ${
                    initialsColor === 'tertiary' ? 'ring-2 ring-offset-2 ring-[#8d4b00] scale-110' : ''
                  }`}
                  title="Warm Amber"
                />
                <button
                  type="button"
                  onClick={() => setInitialsColor('slate')}
                  className={`w-8 h-8 rounded-full bg-[#283044] transition-transform cursor-pointer ${
                    initialsColor === 'slate' ? 'ring-2 ring-offset-2 ring-[#283044] scale-110' : ''
                  }`}
                  title="Slate Monochrome"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalState('crop')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#3e4a3d] hover:bg-[#eaedff] transition-colors cursor-pointer"
              >
                Keep Photo
              </button>
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="px-5 py-2 rounded-xl bg-[#ba1a1a] hover:bg-[#93000a] text-white text-xs font-semibold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
                <span>Reset to Initials</span>
              </button>
            </div>
          </div>
        )}

        {/* Toast confirmation */}
        {showToast && (
          <div className="absolute bottom-4 left-6 right-6 p-3 rounded-xl bg-[#131b2e] text-white shadow-xl flex items-center gap-2 text-xs font-medium animate-in fade-in slide-in-from-bottom-2">
            <span className="material-symbols-outlined text-[#7ffc97] text-[18px]">check_circle</span>
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
