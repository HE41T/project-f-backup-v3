import React, { useState } from 'react';
import ImageDisplay from './components/ImageDisplay';
import MethodSelector from './components/MethodSelector';
import ProcessingOptions from './components/ProcessingOptions';
import ResizeControls from './components/ResizeControls';
import DownloadSection from './components/DownloadSection';

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
  defaultValue: 0
};

function FileUploader() {
  const [file, setFile] = useState(null);
  const [originalFile, setOriginalFile] = useState(null);
  const [resizedFile, setResizedFile] = useState(null); // เพิ่ม state สำหรับไฟล์ที่ resize แล้ว
  const [fileSizeKB, setFileSizeKB] = useState(0);
  const [originalFileSizeKB, setOriginalFileSizeKB] = useState(0);
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [isLinked, setIsLinked] = useState(true);
  const [aspectRatio, setAspectRatio] = useState(null);
  const [method, setMethod] = useState('nearest');
  const [showOriginal, setShowOriginal] = useState(true);
  const [downloadFormat, setDownloadFormat] = useState("original");
  const [isDownloading, setIsDownloading] = useState(false);
  const [sharpness, setSharpness] = useState(SHARPNESS_CONFIG.defaultValue);
  const [noiseReduction, setNoiseReduction] = useState(NOISE_REDUCTION_CONFIG.defaultValue);
  const [processedFile, setProcessedFile] = useState(null);
  const [processedFileSizeKB, setProcessedFileSizeKB] = useState(0);
  const [processingType, setProcessingType] = useState(null);
  const [currentImageUrl, setCurrentImageUrl] = useState(null);
  const [alertMessage, setAlertMessage] = useState('');

  const [processingOptions, setProcessingOptions] = useState({
    resize: true,
    convert: false,
    sharpen: false
  });

  // ฟังก์ชันคำนวณขนาดไฟล์
  const calculateFileSizeKB = (file) => {
    return file ? Math.round(file.size / 1024) : 0;
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setOriginalFile(selectedFile);
    setResizedFile(null);
    setProcessedFile(null);
    setShowOriginal(true);
    setDownloadFormat("original");
    setSharpness(SHARPNESS_CONFIG.defaultValue); // รีเซ็ต sharpness เป็น 0
    setNoiseReduction(NOISE_REDUCTION_CONFIG.defaultValue); // รีเซ็ต sharpness เป็น 0
    setProcessingOptions({
      resize: true,
      convert: false,
      sharpen: false
    });

    const sizeKB = calculateFileSizeKB(selectedFile);
    setFileSizeKB(sizeKB);
    setOriginalFileSizeKB(sizeKB);
    
    const img = new Image();
    img.onload = () => {
      const ratio = img.width / img.height;
      setAspectRatio(ratio);
      setWidth(img.width);
      setHeight(img.height);
      URL.revokeObjectURL(img.src); // ทำความสะอาด memory
    };
    img.src = URL.createObjectURL(selectedFile);
  };

  const handleWidthChange = (e) => {
    const newWidth = parseInt(e.target.value);
    if (isNaN(newWidth)) {
      setWidth('');
      return;
    }
    setWidth(newWidth);
    if (isLinked && aspectRatio) {
      setHeight(Math.round(newWidth / aspectRatio));
    }
  };

  const handleHeightChange = (e) => {
    const newHeight = parseInt(e.target.value);
    if (isNaN(newHeight)) {
      setHeight('');
      return;
    }
    setHeight(newHeight);
    if (isLinked && aspectRatio) {
      setWidth(Math.round(newHeight * aspectRatio));
    }
  };

  const handleResize = async () => {
  setAlertMessage('');

    if (!originalFile || !width || !height) {
      alert('กรุณาเลือกไฟล์และระบุขนาด');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', originalFile);
      formData.append('width', width);
      formData.append('height', height);

      if (downloadFormat !== "original") {
        const format = downloadFormat.split('/')[1];
        formData.append('target_format', format);
      }

      const response = await fetch(`http://localhost:8000/api/resize/${method}/`, {
        method: 'POST',
        body: formData,
        headers: {
          'Cache-Control': 'no-cache'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'การประมวลผลล้มเหลว');
      }

      const data = await response.json();
      const newImageUrl = `http://localhost:8000${data.url}?t=${Date.now()}`;
      setCurrentImageUrl(newImageUrl);

      // ดึงไฟล์ที่ resize แล้ว
      const imageResp = await fetch(newImageUrl);
      const blob = await imageResp.blob();
      const newFile = new File([blob], `resized_${originalFile.name}`, { type: blob.type });

      setResizedFile(newFile);
      setFile(newFile);
      setFileSizeKB(calculateFileSizeKB(newFile));
      setShowOriginal(false);
      setProcessingType('resize');
      setSharpness(SHARPNESS_CONFIG.defaultValue); // รีเซ็ต sharpness เป็น 0
      setNoiseReduction(NOISE_REDUCTION_CONFIG.defaultValue); // รีเซ็ต sharpness เป็น 0

      // อัปเดตขนาดภาพใหม่
      const img = new Image();
      img.onload = () => {
        setWidth(img.naturalWidth);
        setHeight(img.naturalHeight);
        setAspectRatio(img.naturalWidth / img.naturalHeight);
        URL.revokeObjectURL(img.src);
      };
      img.src = newImageUrl;

    } catch (err) {
      console.error('Processing error:', err);
      alert(`การประมวลผลล้มเหลว: ${err.message}`);
    }
  };

const handleSharpen = async (sharpnessValue = sharpness) => {
  // ใช้ sharpnessValue ที่รับเข้ามาแทน sharpness
  if (!resizedFile) {
    setAlertMessage('กรุณาปรับขนาดภาพก่อนเพิ่มความคมชัด');
    // setTimeout(() => setAlertMessage(''), 1500); // หายไปหลังจาก 1.2 วินาที
    return;
  }

  try {
    const formData = new FormData();
    formData.append("sharpness", sharpnessValue.toString()); // ใช้ sharpnessValue แทน sharpness

    const response = await fetch(`http://localhost:8000/api/resize/${method}/sharpen`, {
      method: 'POST',
      body: formData,
      headers: {
        'Cache-Control': 'no-cache'
      }
    });

    // ส่วนที่เหลือของโค้ดเหมือนเดิม...
    const data = await response.json();
    const sharpenedUrl = `http://localhost:8000${data.url}?t=${Date.now()}`;
    setCurrentImageUrl(sharpenedUrl);

    // ดึงไฟล์ที่ sharpen แล้ว
    const imageResp = await fetch(sharpenedUrl);
    const blob = await imageResp.blob();
    const newFile = new File([blob], `sharpened_${resizedFile.name}`, { type: blob.type });

    setProcessedFile(newFile);
    setFile(newFile);
    setProcessedFileSizeKB(calculateFileSizeKB(newFile));
    setProcessingType('sharpen');
    setShowOriginal(false);

    const img = new Image();
    img.onload = () => {
      setWidth(img.naturalWidth);
      setHeight(img.naturalHeight);
      setAspectRatio(img.naturalWidth / img.naturalHeight);
      URL.revokeObjectURL(img.src);
    };
    img.src = sharpenedUrl;

  } catch (err) {
    console.error('Sharpening error:', err);
    alert(`การเพิ่มความคมชัดล้มเหลว: ${err.message}`);
  }
};

const enhanceImage = async (noiseReductionValue = 0.0, autoDetect = true) => {
  if (!resizedFile) {
    setAlertMessage('กรุณาปรับขนาดหรือเพิ่มความคมชัดก่อนทำการปรับปรุงภาพ');
    return;
  }

  try {
    const formData = new FormData();
    formData.append("noise_reduction", noiseReductionValue.toString());

    const response = await fetch(`http://localhost:8000/api/resize/${method}/enhance_image`, {
      method: 'POST',
      body: formData,
      headers: {
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error("ไม่สามารถปรับปรุงภาพได้");
    }

    const data = await response.json();
    const enhancedUrl = `http://localhost:8000${data.url}?t=${Date.now()}`;
    setCurrentImageUrl(enhancedUrl);

    // โหลดไฟล์ใหม่ที่ถูก enhance
    const imageResp = await fetch(enhancedUrl);
    const blob = await imageResp.blob();
    const newFile = new File([blob], `enhanced_${resizedFile?.name}`, { type: blob.type });

    setProcessedFile(newFile);
    setFile(newFile);
    setProcessedFileSizeKB(calculateFileSizeKB(newFile));
    setProcessingType('enhance');
    setShowOriginal(false);

    const img = new Image();
    img.onload = () => {
      setWidth(img.naturalWidth);
      setHeight(img.naturalHeight);
      setAspectRatio(img.naturalWidth / img.naturalHeight);
      URL.revokeObjectURL(img.src);
    };
    img.src = enhancedUrl;

  } catch (err) {
    console.error('Enhance image error:', err);
    alert(`การปรับปรุงภาพล้มเหลว: ${err.message}`);
  }
};


  const toggleShowOriginal = () => {
    setShowOriginal(!showOriginal);
    if (showOriginal) {
      setFileSizeKB(calculateFileSizeKB(file));
    } else {
      setFileSizeKB(originalFileSizeKB);
    }
  };

const handleDownload = async () => {
  if (!file) return;
  
  setIsDownloading(true);
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const isOriginal = downloadFormat === 'original';
    const endpoint = isOriginal ? '/' : '/convert';
    
    if (width) formData.append('width', width);
    if (height) formData.append('height', height);
    
    if (!isOriginal) {
      const format = downloadFormat.split('/')[1];
      formData.append('target_format', format);
    }

    // เพิ่ม timestamp เพื่อป้องกัน cache
    const timestamp = Date.now();
    const response = await fetch(`http://localhost:8000/api/resize/${method}${endpoint}?t=${timestamp}`, {
      method: 'POST',
      body: formData,
      headers: {
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error('Server error');
    }

    const result = await response.json();
    
    // เพิ่ม timestamp สำหรับการโหลดไฟล์
    const downloadResponse = await fetch(`http://localhost:8000${result.url}?t=${timestamp}`, {
      cache: 'no-store'
    });
    
    if (!downloadResponse.ok) {
      throw new Error('Failed to fetch processed image');
    }

    const blob = await downloadResponse.blob();

    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = result.filename || `download.${result.used_extension || 'jpg'}`;
    document.body.appendChild(link);
    link.click();
    
    // ทำความสะอาดหลังจากดาวน์โหลด
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    }, 100);

  } catch (error) {
    console.error('Download error:', error);
    alert('ดาวน์โหลดล้มเหลว: ' + (error.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ'));
  } finally {
    setIsDownloading(false);
  }
};

  const toggleProcessingOption = (option) => {
    setProcessingOptions(prev => ({
      ...prev,
      [option]: !prev[option]
    }));
  };

  return (
    <div className="grid grid-cols-4 grid-rows-5 h-screen">
    <ImageDisplay
      file={file}
      originalFile={originalFile}
      processedFile={processedFile}
      showOriginal={showOriginal}
      fileSizeKB={showOriginal ? originalFileSizeKB : fileSizeKB}
      processedFileSizeKB={processedFileSizeKB}
      handleFileChange={handleFileChange}
      processingType={processingType}
      currentImageUrl={currentImageUrl} // ส่ง currentImageUrl ไป
    />

      <div className="col-start-4 col-span-2 row-span-5 overflow-y-auto scroll-smooth flex flex-col bg-[#292C31] text-gray-300">
        <div className="bg-[#24262b] p-3 mb-4">
          <h2 className="text-xl font-semibold text-[#00969D]">ตัวเลือก ปรับขนาด</h2>
        </div>

        <MethodSelector 
          method={method}
          setMethod={setMethod}
          originalFile={originalFile}
        />

        <ProcessingOptions 
          processingOptions={processingOptions}
          toggleProcessingOption={toggleProcessingOption}
          originalFile={originalFile}
          sharpness={sharpness}
          setSharpness={setSharpness}
          handleSharpen={handleSharpen}
          enhanceImage={enhanceImage}
          noiseReduction={noiseReduction}
          setNoiseReduction={setNoiseReduction}
        />

        <ResizeControls 
          width={width}
          height={height}
          handleWidthChange={handleWidthChange}
          handleHeightChange={handleHeightChange}
          isLinked={isLinked}
          setIsLinked={setIsLinked}
          originalFile={originalFile}
          processingOptions={processingOptions}
        />
        
        <div className="p-2">
          {alertMessage && (
            <div className="mb-4 p-2 bg-yellow-100 text-yellow-800 rounded">
              {alertMessage}
            </div>
          )}
        <DownloadSection
          file={file}
          originalFile={originalFile}
          handleResize={handleResize}
          showOriginal={showOriginal}
          handleDownload={handleDownload}
          isDownloading={isDownloading}
          downloadFormat={downloadFormat}
          setDownloadFormat={setDownloadFormat}
          width={width}
          height={height}
          processingOptions={processingOptions}
          sharpness={sharpness}
          noiseReduction={noiseReduction}
          aspectRatio={aspectRatio}
          toggleShowOriginal={toggleShowOriginal}
          currentImageUrl={currentImageUrl}
        />
        </div>
      </div>
    </div>
  );
}

export default FileUploader;