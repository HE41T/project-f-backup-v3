import React from 'react';

const ResizeControls = ({
  width,
  height,
  handleWidthChange,
  handleHeightChange,
  isLinked,
  setIsLinked,
  originalFile,
  processingOptions
}) => {
  if (!processingOptions.resize) return null;

  return (
    <div className="mb-3 bg-[#24262B] p-4 border border-[#24262B] rounded-xl">
      {/* เปลี่ยน flex-direction เป็น column ใน mobile และ row ใน md ขึ้นไป */}
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        
        {/* Width input - อยู่บนสุดใน mobile, ซ้ายสุดใน desktop */}
        <div className="md:flex-1 w-full">
          <label className="block text-sm text-white font-medium mb-1 px-1">
            ความกว้าง
          </label>
          <input
            type="number"
            placeholder="Width"
            value={width}
            onChange={handleWidthChange}
            disabled={!originalFile}
            className={`w-full px-3 py-2 rounded-lg ${
              originalFile 
                ? 'bg-[#303339] border border-[#00969D]/30 text-white focus:ring-2 focus:ring-[#00969D]' 
                : 'bg-[#303339]/50 text-gray-500 cursor-not-allowed'
            }`}
          />
        </div>

        {/* Link button - อยู่กลางใน mobile, กลางใน desktop */}
        <div className="flex flex-col items-center md:items-end md:mb-1">
          <label className="text-sm text-white font-medium mb-1">
            ซิงค์
          </label>
          <button
            onClick={() => setIsLinked(!isLinked)}
            disabled={!originalFile}
            className={`p-2 rounded-lg transition-all ${
              originalFile 
                ? isLinked 
                  ? 'bg-[#00969D] text-white hover:bg-[#007980] shadow-md' 
                  : 'bg-[#24262B] hover:bg-[#303339]'
                : 'bg-[#24262B]/30 text-gray-500 cursor-not-allowed'
            }`}
            title="Toggle aspect ratio link"
          >
            🔗
          </button>
        </div>

        {/* Height input - อยู่ล่างสุดใน mobile, ขวาสุดใน desktop */}
        <div className="md:flex-1 w-full">
          <label className="block text-sm text-white font-medium mb-1 px-1">
            ความสูง
          </label>
          <input
            type="number"
            placeholder="Height"
            value={height}
            onChange={handleHeightChange}
            disabled={!originalFile}
            className={`w-full px-3 py-2 rounded-lg ${
              originalFile 
                ? 'bg-[#303339] border border-[#00969D]/30 text-white focus:ring-2 focus:ring-[#00969D]' 
                : 'bg-[#303339]/50 text-gray-500 cursor-not-allowed'
            }`}
          />
        </div>
      </div>
    </div>
  );
};

export default ResizeControls;