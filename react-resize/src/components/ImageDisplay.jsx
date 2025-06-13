import React from 'react';

const ImageDisplay = ({ 
  file,
  originalFile,
  processedFile,
  showOriginal,
  fileSizeKB,
  processedFileSizeKB,
  handleFileChange,
  processingType,
  currentImageUrl,
  toggleShowOriginal // ฟังก์ชันสลับดูภาพต้นฉบับ/ประมวลผล
}) => {
  // ฟังก์ชันกำหนดข้อความแสดงสถานะ
  const getStatusText = () => {
    if (showOriginal) return 'รูปต้นฉบับ';
    if (!processedFile) return 'รูปหลังปรับขนาด';
    return processingType === 'sharpen' ? 'รูปหลังเพิ่มความคมชัด' : 'รูปหลังปรับขนาด';
  };

  // ฟังก์ชันกำหนดขนาดไฟล์ที่จะแสดง
  const getDisplayFileSize = () => {
    const size = showOriginal ? fileSizeKB : 
                (processingType === 'resize' ? fileSizeKB : (processedFileSizeKB || fileSizeKB));
    return size;
  };

  return (
    <div className="col-span-3 row-span-5 p-4 flex flex-col bg-[#171719] border-r border-[#24262B]/50">
      <div className="flex justify-center">
        <label
          htmlFor="image-upload"
          className="inline-block bg-[#00969D] text-white px-20 py-2 rounded-lg cursor-pointer 
                   hover:bg-[#007980] transition-all shadow-md hover:shadow-lg active:scale-95"
        >
          เลือกรูปภาพ
        </label>
        <input
          id="image-upload"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {(file || processedFile) && (
        <>
          <div className="flex justify-between items-center mt-4">
            <h3 className="font-bold text-[#00969D]">
              {getStatusText()}
            </h3>
            <div className="font-bold text-[#e06c75]">
              หากภาพมีปัญหาให้อัพโหลดใหม่ / กดปรับขนาด
            </div>
          </div>
            <>
              <p className="mb-2 text-sm text-gray-400">
                ขนาดไฟล์: {getDisplayFileSize()} KB
                {processedFile && !showOriginal && (
                  <span className="ml-2 text-[#00969D]">
                    ({processingType === 'sharpen' ? 'เพิ่มความคมชัดแล้ว' : 'ปรับขนาดแล้ว'})
                  </span>
                )}
              </p>
              
              <div className="flex-1 flex items-center justify-center overflow-hidden rounded-lg bg-[#24262B] border border-[#292C31]">
                <img
                  src={showOriginal ? URL.createObjectURL(originalFile) : currentImageUrl}
                  alt={showOriginal ? 'original' : 'processed'}
                  className="object-contain max-h-full max-w-full"
                  onLoad={(e) => {
                    if (e.target.src.startsWith('blob:')) {
                      URL.revokeObjectURL(e.target.src);
                    }
                  }}
                />
              </div>
            </>
        </>
      )}
    </div>
  );
};

export default ImageDisplay;