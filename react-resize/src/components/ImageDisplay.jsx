import React from 'react';

const ImageDisplay = ({ 
  file,
  originalFile,
  processedFile,
  showOriginal,
  fileSizeKB,
  handleFileChange,
  currentImageUrl,
}) => {
  // ฟังก์ชันกำหนดข้อความแสดงสถานะ
  const getStatusText = () => {
    if (showOriginal) return 'ต้นฉบับ';
    if (!processedFile) return 'หลังปรับขนาด';
    return 'รูปหลังปรับปรุง';
  };

  // สร้าง URL สำหรับภาพที่แสดงผล
  const getImageUrl = () => {
    if (showOriginal) {
      return originalFile ? URL.createObjectURL(originalFile) : '';
    }
    return currentImageUrl || '';
  };

  // ฟังก์ชันจัดการเมื่อโหลดภาพสำเร็จ
  const handleImageLoad = (e) => {
    // ทำความสะอาด Object URL เมื่อใช้แล้ว
    if (e.target.src.startsWith('blob:')) {
      URL.revokeObjectURL(e.target.src);
    }
  };

  // ฟังก์ชันจัดการเมื่อโหลดภาพไม่สำเร็จ
  const handleImageError = (e) => {
    console.error('Failed to load image:', e.target.src);
    // สามารถเพิ่ม fallback image ได้ที่นี่หากต้องการ
  };

  return (
    <div class="
      md:static md:inset-auto  <!-- ยกเลิก fixed และ inset-0 ใน md -->
      fixed inset-0            <!-- ค่า default สำหรับ mobile -->
      col-span-4 md:col-span-3 
      row-span-5 p-4 flex flex-col 
      bg-[#171719] border-r border-[#24262B]/50
    ">
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
          <div className="flex justify-between items-center mt-4 mb-1">
            <h3 className="font-bold text-[#00969D] text-2xl">
              {getStatusText()}
            </h3>
            <div className="font-bold text-[#e06c75] text-medium">
              ภาพมีปัญหาให้กดปรับขนาด
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center overflow-hidden rounded-lg bg-[#24262B] border border-[#292C31]">
            {getImageUrl() && (
              <img
                key={currentImageUrl} // ใช้ key เพื่อบังคับให้โหลดใหม่เมื่อ URL เปลี่ยน
                src={getImageUrl()}
                alt={showOriginal ? 'original' : 'processed'}
                className="object-contain max-h-full max-w-full"
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ImageDisplay;