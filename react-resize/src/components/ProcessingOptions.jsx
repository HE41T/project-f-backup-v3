import React, { useState, useEffect } from 'react';

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

const ProcessingOptions = ({
  sharpness,
  setSharpness,
  handleSharpen,
  enhanceImage,
  originalFile,
  isProcessing,
  noiseReduction,
  setNoiseReduction,
}) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [isEnhancePopupOpen, setIsEnhancePopupOpen] = useState(false);
  const [img] = useState(new Image());

  useEffect(() => {
    return () => {
      if (img.src) {
        URL.revokeObjectURL(img.src);
      }
    };
  }, [img]);

  return (
    <div className="mb-3 px-4">
      <label className="block mb-1 font-medium text-gray-300">ตัวเลือกเพิ่มเติม</label>

      {/* Sharpness Button */}
      <button
        onClick={() => setIsPopupOpen(true)}
        disabled={!originalFile || isProcessing}
        className={`px-4 py-2 rounded-lg mb-2 w-full ${
          originalFile
            ? sharpness === SHARPNESS_CONFIG.defaultValue
              ? 'bg-[#24262B] text-gray-300 hover:bg-[#454852]'
              : 'bg-[#00969D] text-white hover:bg-[#007980]'
            : 'bg-[#24262B]/30 text-gray-500 cursor-not-allowed'
        } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isProcessing ? 'กำลังประมวลผล...' : '(-) ความเบลอ / ความคมชัด (+)'}
      </button>

      {/* Enhance Button */}
      <button
        onClick={() => setIsEnhancePopupOpen(true)}
        disabled={!originalFile || isProcessing}
        className={`px-4 py-2 rounded-lg w-full ${
          originalFile
            ? noiseReduction === NOISE_REDUCTION_CONFIG.defaultValue
              ? 'bg-[#24262B] text-gray-300 hover:bg-[#454852]'
              : 'bg-[#00A169] text-white hover:bg-[#008A57]'
            : 'bg-[#24262B]/30 text-gray-500 cursor-not-allowed'
        } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isProcessing ? 'กำลังปรับปรุง...' : 'ลดสัญญาณรบกวน'}
      </button>

      {/* Sharpness Popup */}
      {isPopupOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        onClick={() => setIsPopupOpen(false)} // ปิดเมื่อกดนอกกล่อง
        >
          <div className="relative bg-[#24262B] p-6 rounded-lg max-w-md w-full border border-[#36383D]"
          onClick={(e) => e.stopPropagation()} // ป้องกันการปิดถ้าคลิกในกล่อง
          >
            {/* ปุ่มปิดมุมขวาบน */}
            <button
              onClick={() => setIsPopupOpen(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-white text-lg"
              title="ปิด"
            >
              ×
            </button>
            <h3 className="text-lg font-medium text-gray-200 mb-4">
              ตั้งค่าระดับความคมชัด
            </h3>
            
            <div className="mb-4">
              <label className="block mb-3 font-medium text-gray-200">
                ระดับความคมชัด : <span className="text-[#00969D]">{sharpness.toFixed(1)}</span>
                {sharpness !== 0 && (
                  <span className="ml-2 text-sm text-[#00969D]">
                    {sharpness > 0 ? 'เพิ่มความคมชัด' : 'ลดความคมชัด'}
                  </span>
                )}
              </label>
              
              <input
                type="range"
                min={SHARPNESS_CONFIG.min}
                max={SHARPNESS_CONFIG.max}
                step={SHARPNESS_CONFIG.step}
                value={sharpness}
                onChange={(e) => setSharpness(parseFloat(e.target.value))}
                disabled={isProcessing}
                className="w-full h-1.5 bg-[#69707d] rounded-lg appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00969D]
                  [&::-webkit-slider-thumb]:shadow-md
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
              
              <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                <span className={`${sharpness === SHARPNESS_CONFIG.min ? 'font-bold text-[#00969D]' : ''}`}>เบลอ</span>
                <span className={`${sharpness === 0 ? 'font-bold text-[#00969D]' : ''}`}>ปกติ</span>
                <span className={`${sharpness === SHARPNESS_CONFIG.max ? 'font-bold text-[#00969D]' : ''}`}>คมชัด</span>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setIsPopupOpen(false);
                  handleSharpen(0);
                  setSharpness(SHARPNESS_CONFIG.defaultValue);
                }}
                disabled={isProcessing}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white disabled:opacity-50"
              >
                รีเซ็ต
              </button>
              <button
                onClick={() => {
                  handleSharpen();
                  setIsPopupOpen(false);
                }}
                disabled={isProcessing}
                className={`px-4 py-2 bg-[#00969D] text-white rounded-md hover:bg-[#00838A] transition-colors ${
                  isProcessing ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                {isProcessing ? 'กำลังประมวลผล...' : 'ตกลง'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enhance Popup */}
      {isEnhancePopupOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setIsEnhancePopupOpen(false)} // Fixed: Changed to setIsEnhancePopupOpen
        >
          <div 
            className="relative bg-[#24262B] p-6 rounded-lg max-w-md w-full border border-[#36383D]"
            onClick={(e) => e.stopPropagation()} // Fixed: Changed to stopPropagation
          >
            {/* ปุ่มปิดมุมขวาบน */}
            <button
              onClick={() => setIsEnhancePopupOpen(false)} // Fixed: Changed to setIsEnhancePopupOpen
              className="absolute top-3 right-3 text-gray-400 hover:text-white text-lg"
              title="ปิด"
            >
              ×
            </button>
            <h3 className="text-lg font-medium text-gray-200 mb-4">
              ลดสัญญาณรบกวน
            </h3>

            <div className="mb-4">
              <label className="block mb-2 text-sm font-medium text-gray-200">
                ระดับการลด Noise: <span className="text-[#00A169]">{noiseReduction.toFixed(1)}</span>
                {noiseReduction > 0 && (
                  <span className="ml-2 text-sm text-[#00A169]">
                    {noiseReduction <= 3 ? 'ลดน้อย' : 
                    noiseReduction <= 5 ? 'ลดปานกลาง' : 'ลดมาก'}
                  </span>
                )}
              </label>
              
              <input
                type="range"
                min={NOISE_REDUCTION_CONFIG.min}
                max={NOISE_REDUCTION_CONFIG.max}
                step={NOISE_REDUCTION_CONFIG.step}
                value={noiseReduction}
                onChange={(e) => setNoiseReduction(parseFloat(e.target.value))}
                disabled={isProcessing}
                className="w-full h-1.5 bg-[#69707d] rounded-lg appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00A169]
                  [&::-webkit-slider-thumb]:shadow-md
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
              
              <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                <span className={`${noiseReduction === NOISE_REDUCTION_CONFIG.min ? 'font-bold text-[#00A169]' : ''}`}>ไม่ลด</span>
                <span className={`${noiseReduction === 3 ? 'font-bold text-[#00A169]' : ''}`}>ปานกลาง</span>
                <span className={`${noiseReduction === NOISE_REDUCTION_CONFIG.max ? 'font-bold text-[#00A169]' : ''}`}>ลดมาก</span>
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setIsEnhancePopupOpen(false);
                  enhanceImage(0);
                  setNoiseReduction(NOISE_REDUCTION_CONFIG.defaultValue);
                }}
                disabled={isProcessing}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white disabled:opacity-50"
              >
                รีเซ็ต
              </button>
              <button
                onClick={() => {
                  enhanceImage(noiseReduction);
                  setIsEnhancePopupOpen(false);
                }}
                disabled={isProcessing}
                className={`px-4 py-2 bg-[#00A169] text-white rounded-md hover:bg-[#008A57] transition-colors ${
                  isProcessing ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                {isProcessing ? 'กำลังประมวลผล...' : 'ตกลง'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessingOptions;



// import React, { useState, useEffect } from 'react';

// const SHARPNESS_CONFIG = {
//   min: -2,
//   max: 2,
//   step: 0.1,
//   defaultValue: 0
// };

// const ProcessingOptions = ({ 
//   sharpness, 
//   setSharpness, 
//   handleSharpen,
//   originalFile,
// }) => {
//   const [isPopupOpen, setIsPopupOpen] = useState(false);
//   const [isProcessing] = useState(false);
//   const [img] = useState(new Image());

//   useEffect(() => {
//     return () => {
//       if (img.src) {
//         URL.revokeObjectURL(img.src);
//       }
//     };
//   }, [img]);


//   return (
//     <div className="mb-3 px-4">
//       <label className="block mb-1 font-medium text-gray-300">ตัวเลือกเพิ่มเติม</label>
//       <button
//         onClick={() => { 
//           setIsPopupOpen(true);
//         }}
//         disabled={!originalFile}
//         className={`px-4 py-2 rounded-lg ${
//           originalFile
//             ? sharpness === SHARPNESS_CONFIG.defaultValue
//               ? 'bg-[#24262B] text-gray-300 hover:bg-[#454852]' // สีปกติเมื่อเป็นค่าเริ่มต้น
//               : 'bg-[#00969D] text-white hover:bg-[#007980]' // สีเมื่อค่าเปลี่ยนจากค่าเริ่มต้น
//             : 'bg-[#24262B]/30 text-gray-500 cursor-not-allowed' // สีเมื่อ disabled
//         } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
//       >
//         {isProcessing ? 'กำลังประมวลผล...' : 'ความคมชัด'}
//       </button>
      
//       {/* Popup */}
//       {isPopupOpen && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
//           <div className="bg-[#24262B] p-6 rounded-lg max-w-md w-full border border-[#36383D]">
//             <h3 className="text-lg font-medium text-gray-200 mb-4">
//               ตั้งค่าระดับความคมชัด
//             </h3>
            
//             <div className="mb-4">
//               <label className="block mb-3 font-medium text-gray-200">
//                 ระดับความคมชัด : <span className="text-[#00969D]">{sharpness.toFixed(1)}</span>
//                 {sharpness !== 0 && (
//                   <span className="ml-2 text-sm text-[#00969D]">
//                     {sharpness > 0 ? 'เพิ่มความคมชัด' : 'ลดความคมชัด'}
//                   </span>
//                 )}
//               </label>
              
//               <input
//                 type="range"
//                 min={SHARPNESS_CONFIG.min}
//                 max={SHARPNESS_CONFIG.max}
//                 step={SHARPNESS_CONFIG.step}
//                 value={sharpness}
//                 onChange={(e) => setSharpness(parseFloat(e.target.value))}
//                 disabled={isProcessing}
//                 className="
//                   w-full h-1.5 bg-[#69707d] rounded-lg appearance-none cursor-pointer
//                   [&::-webkit-slider-thumb]:appearance-none
//                   [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
//                   [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00969D]
//                   [&::-webkit-slider-thumb]:shadow-md
//                   disabled:opacity-50 disabled:cursor-not-allowed
//                 "
//               />
              
//               <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
//                 <span className={`${sharpness === SHARPNESS_CONFIG.min ? 'font-bold text-[#00969D]' : ''}`}>เบลอ</span>
//                 <span className={`${sharpness === 0 ? 'font-bold text-[#00969D]' : ''}`}>ปกติ</span>
//                 <span className={`${sharpness === SHARPNESS_CONFIG.max ? 'font-bold text-[#00969D]' : ''}`}>คมชัด</span>
//               </div>
//             </div>
            
//             <div className="flex justify-end space-x-3">
//               <button
//                 onClick={() => {
//                   setIsPopupOpen(false);
//                   handleSharpen(0); // ส่ง 0 ไปให้ handleSharpen
//                   setSharpness(SHARPNESS_CONFIG.defaultValue);
//                 }}
//                 disabled={isProcessing}
//                 className="px-4 py-2 text-sm text-gray-300 hover:text-white disabled:opacity-50"
//               >
//                 รีเซ็ต
//               </button>
//               <button
//                 onClick={ () => {
//                   handleSharpen();
//                   setIsPopupOpen(false);
//                 }}
//                 disabled={isProcessing}
//                 className={`px-4 py-2 bg-[#00969D] text-white rounded-md hover:bg-[#00838A] transition-colors ${
//                   isProcessing ? 'opacity-75 cursor-not-allowed' : ''
//                 }`}
//               >
//                 {isProcessing ? 'กำลังประมวลผล...' : 'ตกลง'}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// };

// export default ProcessingOptions;