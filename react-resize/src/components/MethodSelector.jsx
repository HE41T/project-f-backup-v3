import React from 'react';

const MethodSelector = ({ method, setMethod, originalFile }) => {
  return (
    <div className="px-4 mb-4">
      <label className="block mb-2 font-medium text-gray-300">วิธีการแก้ไข</label>
      <select
        value={method}
        onChange={(e) => setMethod(e.target.value)}
        disabled={!originalFile}
        className={`w-full px-3 py-2 rounded-lg transition-all ${
          originalFile 
            ? 'bg-[#24262B] hover:bg-[#454852] text-white focus:ring-2 focus:ring-[#00969D]'
            : 'bg-[#24262B]/50 text-gray-500 cursor-not-allowed'
        }`}
      >
        <option value="nearest">Nearest Neighbor</option>
        <option value="bilinear">Bilinear</option>
        <option value="bicubic">Bicubic</option>
      </select>
    </div>
  );
};

export default MethodSelector;