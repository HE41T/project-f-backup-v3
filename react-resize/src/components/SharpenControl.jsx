import React, { useState } from 'react';

const SHARPNESS_CONFIG = {
  min: -2,
  max: 2,
  step: 0.1,
  defaultValue: 0
};

const SharpenControl = ({ sharpness, setSharpness, processingOptions, originalFile, toggleProcessingOption}) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  
  if (!processingOptions.sharpen) return null;

  const handleOkClick = () => {
    setIsPopupOpen(false);
  };

  return (
    <>
      {/* ปุ่มเปิด Popup */}
      <button
        onClick={() => setIsPopupOpen(true)}
        className="mb-3 bg-[#24262B] p-4 border border-[#24262B] w-full text-left"
      >
        <span className="font-medium text-gray-200">
          ระดับความคมชัด : <span className="text-[#00969D]">{sharpness.toFixed(1)}</span>
          {sharpness !== 0 && (
            <span className="ml-2 text-sm text-[#00969D]">
              {sharpness > 0 ? 'เพิ่มความคมชัด' : 'ลดความคมชัด'}
            </span>
          )}
        </span>
      </button>

      {/* Popup */}
      {isPopupOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#24262B] p-6 rounded-lg max-w-md w-full border border-[#36383D]">
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
                className="
                  w-full h-1.5 bg-[#69707d] rounded-lg appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none
                  [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#00969D]
                  [&::-webkit-slider-thumb]:shadow-md
                "
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
                  setSharpness(SHARPNESS_CONFIG.defaultValue);
                  setIsPopupOpen(false);
                }}
                className="px-4 py-2 text-sm text-gray-300 hover:text-white"
              >
                รีเซ็ต
              </button>
              <button
                onClick={handleOkClick}
                className="px-4 py-2 bg-[#00969D] text-white rounded-md hover:bg-[#00838A] transition-colors"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SharpenControl;