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
    <div className="mb-3 bg-[#24262B] p-4 border border-[#24262B]">
      <div className="flex items-center gap-2">
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
        <button
          onClick={() => setIsLinked(!isLinked)}
          disabled={!originalFile}
          className={`p-2 rounded-lg transition-all ${
            originalFile 
              ? isLinked 
                ? 'bg-[#00969D] text-white hover:bg-[#007980] shadow-md' 
                : 'bg-[#24262B] hover:bg-[#24262B]/80'
              : 'bg-[#24262B]/30 text-gray-500 cursor-not-allowed'
          }`}
          title="Toggle aspect ratio link"
        >
          🔗
        </button>
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
  );
};

export default ResizeControls;