import React, { useState } from 'react';

const SHARPNESS_CONFIG = {
  min: -2,
  max: 2,
  step: 0.1,
  defaultValue: 0
};

const NOISE_REDUCTION_CONFIG = {
  min: 0.0,
  max: 10.0,
  step: 0.1,
  defaultValue: 0.0
};

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
  noiseReduction,
  aspectRatio,
  toggleShowOriginal,
  currentImageUrl,
}) => {
  const [showDownloadPopup, setShowDownloadPopup] = useState(false);

  if (!file) return null;

  return (
    <>
      {/* ส่วนหลักยังคงรูปแบบเดิม */}
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
            {showOriginal ? 'ดูภาพปรับขนาด' : 'ดูภาพต้นฉบับ'}
          </button>
        )}
      </div>
      
      {file && file !== originalFile && (
        <div className="mt-3">
          <button
            onClick={() => setShowDownloadPopup(true)}
            className="w-full py-3 rounded-lg bg-[#00969D] text-white hover:bg-[#007980] shadow-md font-medium"
          >
            Download
          </button>
        </div>
      )}

      {/* Popup ที่ใช้ layout ใหม่ */}
      {showDownloadPopup && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowDownloadPopup(false)}
        >
          <div 
            className="bg-[#1E1F23] rounded-lg py-6 px-4 w-full max-w-7xl border border-[#292c31] shadow-xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowDownloadPopup(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-white p-1 rounded-full hover:bg-[#383c43]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            <div className="grid grid-cols-5 h-full">
              {/* ส่วนแสดงภาพ - ด้านซ้าย */}
              <div className="col-span-4 h-full flex items-center justify-center">
                {currentImageUrl && (
                  <img 
                    src={currentImageUrl} 
                    alt="preview"
                    className="max-h-[85vh] w-auto rounded border border-[#292c31] object-contain"
                  />
                )}
              </div>
              
              {/* ส่วนตัวเลือก - ด้านขวา */}
              <div className="col-span-1 flex flex-col">
                <h3 className="text-lg font-medium text-white mb-4">ตัวเลือก Download</h3>

                <div className="flex items-center gap-2 mb-4">
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

                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className={`w-full py-3 rounded-lg transition-all font-medium flex items-center justify-center mb-4 ${
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

                <div className="p-3 bg-[#24262B] border border-[#24262B] text-gray-400 text-sm rounded-lg">
<p>
  <span className="font-medium text-gray-300">ขนาด :</span> {width} × {height} px<br />
  <span className="font-medium text-gray-300">อัตราส่วนภาพ :</span> {aspectRatio ? aspectRatio.toFixed(2) : 'N/A'}
  
  {sharpness !== SHARPNESS_CONFIG.defaultValue && (
    <>
      <br />
      <span className="font-medium text-gray-300">ระดับความคมชัด :</span> {sharpness.toFixed(1)}
    </>
  )}

  {noiseReduction !== NOISE_REDUCTION_CONFIG.defaultValue && (
    <>
      <br />
      <span className="font-medium text-gray-300">ระดับการลดนอยซ์ :</span> {noiseReduction.toFixed(1)}
    </>
  )}
</p>

                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DownloadSection;



// import React from 'react';
// import SHARPNESS_CONFIG from './SharpenControl';

// const DownloadSection = ({
//   file,
//   originalFile,
//   handleResize,
//   showOriginal,
//   handleDownload,
//   isDownloading,
//   downloadFormat,
//   setDownloadFormat,
//   width,
//   height,
//   processingOptions,
//   sharpness,
//   aspectRatio,
//   toggleShowOriginal, // ฟังก์ชันสลับดูภาพต้นฉบับ/ประมวลผล
//   processedFile,
//   fileSizeKB,
//   processedFileSizeKB,
//   handleFileChange,
//   processingType,
//   currentImageUrl,
//   showComparison, // เพิ่ม prop นี้เพื่อควบคุมโหมดแสดงผล
// }) => {
//   if (!file) return null;

//   return (
//     <>
//       <div className="flex items-center gap-2">
//         <button
//           onClick={handleResize}
//           disabled={!originalFile || (processingOptions.resize && (!width || !height))}
//           className={`w-full py-3 rounded-lg transition-all font-medium flex items-center justify-center ${
//             originalFile && (!processingOptions.resize || (width && height)) 
//               ? 'bg-[#00969D] text-white hover:bg-[#007980] shadow-lg'
//               : ''
//           }`}
//         >
//           {originalFile ? 'ปรับขนาด': ''}
//         </button>
        
//         {file !== originalFile && (
//           <button
//             onClick={toggleShowOriginal}
//             className="w-full py-3 rounded-lg font-medium 
//             bg-[#383c43] hover:bg-[#303339] border border-[#292c31] text-white 
//             text-center"
//           >
//             {showOriginal ? 'ดูภาพปรับขนาด' : 'ดูภาพต้นฉบับ'}
//           </button>
//         )}
//       </div>
      
//       {/* Download Section */}
//       {file && file !== originalFile && (
//         <div className="flex items-center gap-2 mt-3">
//           <button
//             onClick={handleDownload}
//             disabled={isDownloading}
//             className={`w-full py-3 rounded-lg transition-all font-medium flex items-center justify-center ${
//               isDownloading 
//                 ? 'bg-[#24262B]/50 text-gray-500 cursor-not-allowed' 
//                 : 'bg-[#00969D] text-white hover:bg-[#007980] shadow-md'
//             }`}
//           >
//             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
//               <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
//               <polyline points="7 10 12 15 17 10"></polyline>
//               <line x1="12" y1="15" x2="12" y2="3"></line>
//             </svg>
//             {isDownloading ? 'Downloading...' : 'Download'}
//           </button>
//           <select
//             value={downloadFormat}
//             onChange={(e) => setDownloadFormat(e.target.value)}
//             className="w-full py-3 rounded-lg transition-all font-medium flex
//             bg-[#383c43] hover:bg-[#303339] border border-[#292c31] text-white 
//             text-center focus:ring-2 focus:ring-[#00969D]"
//             disabled={isDownloading}
//           >
//             <option value="original">นามสกุลต้นฉบับ</option>
//             <option value="image/jpeg">JPEG (.jpg)</option>
//             <option value="image/png">PNG (.png)</option>
//             <option value="image/webp">WEBP (.webp)</option>
//           </select>
//         </div>
//       )}

//       {/* Current Dimensions */}
//       <div className="mt-4 p-3 bg-[#24262B] border border-[#24262B]">
//         <p className="text-gray-400">
//           <span className="font-medium text-gray-300">ขนาด :</span> {width} × {height} px
//           <br />
//           <span className="font-medium text-gray-300">อัตราส่วนภาพ :</span> {aspectRatio ? aspectRatio.toFixed(2) : 'N/A'}
//           {sharpness !== SHARPNESS_CONFIG.defaultValue && (
//             <>
//               <br />
//               <span className="font-medium text-gray-300">ระดับความคมชัด :</span> {sharpness.toFixed(1)}
//             </>
//           )}
//         </p>
//       </div>
//     </>
//   );
// };

// export default DownloadSection;