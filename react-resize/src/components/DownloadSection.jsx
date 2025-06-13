import React from 'react';
import SHARPNESS_CONFIG from './SharpenControl';

const DownloadSection = ({
  file,
  originalFile,
  handleResize,
  showOriginal,
  handleDownload,
  isDownloading,
  downloadFormat,
  setDownloadFormat,
  width,
  height,
  processingOptions,
  sharpness,
  aspectRatio,
  toggleShowOriginal, // ฟังก์ชันสลับดูภาพต้นฉบับ/ประมวลผล
  processedFile,
  fileSizeKB,
  processedFileSizeKB,
  handleFileChange,
  processingType,
  currentImageUrl,
  showComparison, // เพิ่ม prop นี้เพื่อควบคุมโหมดแสดงผล
}) => {
  if (!file) return null;

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleResize}
          disabled={!originalFile || (processingOptions.resize && (!width || !height))}
          className={`w-full py-3 rounded-lg transition-all font-medium flex items-center justify-center ${
            originalFile && (!processingOptions.resize || (width && height)) 
              ? 'bg-[#00969D] text-white hover:bg-[#007980] shadow-lg'
              : ''
          }`}
        >
          {originalFile ? 'ปรับขนาด': ''}
        </button>
        
        {file !== originalFile && (
          <button
            onClick={toggleShowOriginal}
            className="w-full py-3 rounded-lg font-medium 
            bg-[#383c43] hover:bg-[#303339] border border-[#292c31] text-white 
            text-center"
          >
            {showOriginal ? 'ดูภาพที่ประมวลผล' : 'ดูภาพต้นฉบับ'}
          </button>
        )}
      </div>
      
      {/* Download Section */}
      {file && file !== originalFile && (
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={`w-full py-3 rounded-lg transition-all font-medium flex items-center justify-center ${
              isDownloading 
                ? 'bg-[#24262B]/50 text-gray-500 cursor-not-allowed' 
                : 'bg-[#00969D] text-white hover:bg-[#007980] shadow-md'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            {isDownloading ? 'Downloading...' : 'Download'}
          </button>
          <select
            value={downloadFormat}
            onChange={(e) => setDownloadFormat(e.target.value)}
            className="w-full py-3 rounded-lg transition-all font-medium flex
            bg-[#383c43] hover:bg-[#303339] border border-[#292c31] text-white 
            text-center focus:ring-2 focus:ring-[#00969D]"
            disabled={isDownloading}
          >
            <option value="original">นามสกุลต้นฉบับ</option>
            <option value="image/jpeg">JPEG (.jpg)</option>
            <option value="image/png">PNG (.png)</option>
            <option value="image/webp">WEBP (.webp)</option>
          </select>
        </div>
      )}

      {/* Current Dimensions */}
      <div className="mt-4 p-3 bg-[#24262B] border border-[#24262B]">
        <p className="text-gray-400">
          <span className="font-medium text-gray-300">ขนาด :</span> {width} × {height} px
          <br />
          <span className="font-medium text-gray-300">อัตราส่วนภาพ :</span> {aspectRatio ? aspectRatio.toFixed(2) : 'N/A'}
          {sharpness !== SHARPNESS_CONFIG.defaultValue && (
            <>
              <br />
              <span className="font-medium text-gray-300">ระดับความคมชัด :</span> {sharpness.toFixed(1)}
            </>
          )}
        </p>
      </div>
    </>
  );
};

export default DownloadSection;