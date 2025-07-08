import os
import time
from io import BytesIO
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
import pillow_heif
from PIL import Image
import shutil
from pathlib import Path
from PIL import ImageEnhance
from PIL import Image, ImageFilter

router = APIRouter()

# Config
MAX_FILE_SIZE_MB = 10
ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/tiff": "tiff",
    "image/bmp": "bmp",
    "image/x-ms-bmp": "bmp"
}

# สร้างโฟลเดอร์ static หากไม่มี
Path("static").mkdir(exist_ok=True)

def apply_unsharp_mask(image, sharpness_level=0):
    """
    ใช้ Unsharp Mask filter โดยรักษาช่องอัลฟ่า (alpha channel) ของ PNG ไว้
    หาก sharpness_level เป็น 0 จะไม่ทำการปรับความชัดและคืนภาพเดิม
    """
    if sharpness_level == 0:
        return image.copy()  # ส่งคืนสำเนาของภาพเดิมเพื่อป้องกันการแก้ไขโดยไม่ตั้งใจ
    
    # ตรวจสอบโหมดภาพ
    original_mode = image.mode
    
    # แปลงโหมดภาพให้เหมาะสม sharpness ได้ไหม
    if original_mode == 'P':
        # แปลงภาพ Palette-based เป็น RGBA
        image = image.convert('RGBA')
    elif original_mode == 'LA':
        # แปลง grayscale with alpha เป็น RGBA
        image = image.convert('RGBA')
    
    # แยกช่องอัลฟ่าถ้ามี
    has_alpha = image.mode == 'RGBA'
    if has_alpha:
        # แยกช่องสีและช่องอัลฟ่า
        r, g, b, a = image.split()
        rgb_image = Image.merge('RGB', (r, g, b))
        
        # ใช้ Unsharp Mask เฉพาะช่องสี
        radius = 2.0  # ค่า radius เดิม
        percent = int(50 * sharpness_level)  # ลดเปอร์เซ็นต์ลงครึ่งหนึ่งจากเดิม
        threshold = 3  # ค่า threshold เดิม
        
        sharpened_rgb = rgb_image.filter(ImageFilter.UnsharpMask(
            radius=radius,
            percent=percent,
            threshold=threshold
        ))
        
        # รวมช่องอัลฟ่ากลับคืน
        sharpened_r, sharpened_g, sharpened_b = sharpened_rgb.split()
        sharpened_image = Image.merge('RGBA', (sharpened_r, sharpened_g, sharpened_b, a))
        
        return sharpened_image
    else:
        # กรณีไม่มีช่องอัลฟ่า
        radius = 2.0  # ค่า radius เดิม
        percent = int(50 * sharpness_level)  # ลดเปอร์เซ็นต์ลงครึ่งหนึ่งจากเดิม
        threshold = 3  # ค่า threshold เดิม
        
        return image.filter(ImageFilter.UnsharpMask(
            radius=radius,
            percent=percent,
            threshold=threshold
        ))

def generate_filename(prefix: str, width: int, height: int, extension: str):
    """สร้างชื่อไฟล์แบบมี timestamp เพื่อป้องกัน cache"""
    timestamp = int(time.time())
    return f"{prefix}_{width}x{height}_{timestamp}.{extension}"

def cleanup_old_files(directory: str, prefix: str, keep_latest: int = 3):
    """ลบไฟล์เก่า โดยคงไว้เฉพาะล่าสุด"""
    files = sorted(Path(directory).glob(f"{prefix}_*"), key=os.path.getmtime, reverse=True)
    for old_file in files[keep_latest:]:
        try:
            os.remove(old_file)
        except Exception as e:
            print(f"Error deleting {old_file}: {e}")

async def validate_image_file(file: UploadFile):
    # ตรวจสอบประเภทไฟล์
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"ประเภทไฟล์ '{file.content_type}' ไม่รองรับ ต้องเป็นหนึ่งใน: {list(ALLOWED_CONTENT_TYPES.keys())}"
        )
    
    # ตรวจสอบขนาดไฟล์
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"ขนาดไฟล์ใหญ่เกินไป (สูงสุด {MAX_FILE_SIZE_MB}MB)"
        )
    
    return contents

def handle_image_mode(image, target_format):
    """
    จัดการโหมดสีของภาพให้เหมาะสมกับรูปแบบไฟล์ปลายทาง
    โดยรักษาช่องอัลฟ่าไว้สำหรับ PNG
    """
    # สำหรับ PNG ให้รักษา RGBA (ถ้ามี)
    if target_format.lower() == 'png':
        if image.mode == 'P':
            return image.convert('RGBA')
        elif image.mode == 'LA':
            return image.convert('RGBA')
        elif image.mode not in ('RGBA', 'RGB', 'L'):
            return image.convert('RGBA')
        return image
    
    # สำหรับรูปแบบอื่นๆ ใช้การแปลงแบบเดิม
    if target_format.lower() in ['jpg', 'jpeg', 'bmp']:
        if image.mode == 'RGBA':
            background = Image.new('RGB', image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[3])
            return background
        elif image.mode == 'P':
            return image.convert('RGB')
        elif image.mode not in ('RGB', 'L'):
            return image.convert('RGB')
    
    return image

@router.post("/")
async def resize_image(
    file: UploadFile = File(...),
    width: int = Form(...),
    height: int = Form(...),
    target_format: Optional[str] = Form(None),
    sharpness: Optional[float] = Form(1.0)
):
    """Resize ภาพและแปลงรูปแบบ โดยรักษาความโปร่งใสของ PNG"""
    try:
        contents = await validate_image_file(file)
        
        # กำหนดนามสกุลไฟล์ผลลัพธ์
        if target_format and target_format.lower() in ALLOWED_CONTENT_TYPES.values():
            extension = target_format.lower()
        else:
            source_extension = ALLOWED_CONTENT_TYPES.get(file.content_type)
            if not source_extension:
                raise HTTPException(400, "ไม่สามารถกำหนดนามสกุลไฟล์จากประเภทไฟล์ต้นทาง")
            extension = source_extension
        
        # เปิดและประมวลผลภาพ
        with Image.open(BytesIO(contents)) as image:
            print(f"Original image mode: {image.mode}")
            
            # จัดการโหมดสี
            image = handle_image_mode(image, extension)
            
            # Resize ภาพ
            resized = image.resize((width, height), Image.NEAREST)
            
            # ปรับความคมชัด
            if sharpness != 0:
                try:
                    resized = apply_unsharp_mask(resized, sharpness)
                except Exception as e:
                    print(f"Sharpening failed, using original image: {str(e)}")
            
            # บันทึกไฟล์
            filename = generate_filename("nearest", width, height, extension)
            save_path = os.path.join("static", filename)
            
            # ตั้งค่าคุณภาพสำหรับ PNG
            save_params = {}
            if extension in ['jpg', 'jpeg', 'webp']:
                save_params['quality'] = 85
            elif extension == 'png':
                save_params['compress_level'] = 6  # ระดับการบีบอัด PNG
            elif extension == 'tiff':
                save_params['compression'] = 'tiff_deflate'
            
            resized.save(save_path, **save_params)

        cleanup_old_files("static", "nearest")

        return JSONResponse({
            "filename": filename,
            "url": f"/static/{filename}",
            "cache_control": "public, max-age=600, stale-while-revalidate=3600",
            "source_extension": ALLOWED_CONTENT_TYPES.get(file.content_type),
            "used_extension": extension,
            "sharpness_applied": sharpness if sharpness != 1.0 else None,
            "sharpness_method": "unsharp_mask",
            "original_mode": image.mode,
            "final_mode": resized.mode,
            "has_transparency": resized.mode == 'RGBA'  # บอกว่ามีความโปร่งใสหรือไม่
        })
        
    except Exception as e:
        raise HTTPException(500, f"การประมวลผลภาพล้มเหลว: {str(e)}")

@router.post("/convert")
async def convert_image(
    file: UploadFile = File(...),
    target_format: str = Form(...),
    width: Optional[int] = Form(None),
    height: Optional[int] = Form(None),
    sharpness: float = Form(1.0)
):
    """แปลงรูปแบบไฟล์ภาพ โดยรักษาความโปร่งใสสำหรับ PNG"""
    try:
        contents = await validate_image_file(file)
        
        # แปลงชื่อรูปแบบ
        format_mapping = {
            'jpg': 'JPEG',
            'jpeg': 'JPEG',
            'png': 'PNG',
            'webp': 'WEBP',
            'bmp': 'BMP',
            'tiff': 'TIFF'
        }
        
        target_format = target_format.lower()
        if target_format not in format_mapping:
            raise HTTPException(400, detail="รูปแบบไฟล์ปลายทางไม่รองรับ")

        # เปิดภาพ
        image = Image.open(BytesIO(contents))
        print(f"Original image mode: {image.mode}")
        
        # จัดการโหมดสีตามรูปแบบไฟล์ปลายทาง
        def handle_image_mode_for_conversion(img, fmt):
            """จัดการโหมดสีเฉพาะสำหรับการแปลงรูปแบบ"""
            fmt = fmt.lower()
            
            # สำหรับ PNG ให้รักษาช่องอัลฟ่าไว้
            if fmt == 'png':
                if img.mode == 'P':
                    return img.convert('RGBA')
                elif img.mode == 'LA':
                    return img.convert('RGBA')
                elif img.mode not in ('RGBA', 'RGB', 'L'):
                    return img.convert('RGBA')
                return img
            
            # สำหรับ JPEG/BMP ให้แปลงเป็น RGB
            elif fmt in ['jpg', 'jpeg', 'bmp']:
                if img.mode == 'RGBA':
                    background = Image.new('RGB', img.size, (255, 255, 255))
                    background.paste(img, mask=img.split()[3])
                    return background
                elif img.mode == 'P':
                    return img.convert('RGB')
                elif img.mode not in ('RGB', 'L'):
                    return img.convert('RGB')
            
            # สำหรับ WebP และ TIFF สามารถรักษา RGBA ได้
            return img

        image = handle_image_mode_for_conversion(image, target_format)
        
        # ปรับขนาดหากระบุ
        if width and height:
            image = image.resize((width, height), Image.NEAREST)
        
        # ปรับความคมชัด (เฉพาะส่วนที่ไม่ใช่ช่องอัลฟ่า)
        if sharpness != 0:
            try:
                image = apply_unsharp_mask(image, sharpness)
            except Exception as e:
                print(f"Sharpening failed, proceeding without sharpening: {str(e)}")
        
        # สร้างไฟล์ผลลัพธ์
        output_buffer = BytesIO()
        save_params = {}
        
        # ตั้งค่าพารามิเตอร์การบันทึกตามรูปแบบไฟล์
        if target_format in ['jpg', 'jpeg']:
            save_params['quality'] = 85
            if image.mode == 'RGBA':
                image = image.convert('RGB')  # JPEG ไม่รองรับ RGBA
        elif target_format == 'webp':
            save_params['quality'] = 85
            if image.mode == 'LA':
                image = image.convert('RGBA')
        elif target_format == 'png':
            save_params['compress_level'] = 6  # ระดับการบีบอัด PNG
        elif target_format == 'tiff':
            save_params['compression'] = 'tiff_deflate'
        
        # บันทึกภาพลง buffer
        image.save(output_buffer, format=format_mapping[target_format], **save_params)
        output_buffer.seek(0)
        
        # สร้างชื่อไฟล์
        extension = target_format.lower()
        filename = generate_filename("converted", image.width, image.height, extension)
        save_path = os.path.join("static", filename)
        
        # บันทึกไฟล์
        with open(save_path, 'wb') as f:
            f.write(output_buffer.getvalue())
        
        # ลบไฟล์เก่า
        cleanup_old_files("static", "converted")

        return JSONResponse({
            "filename": filename,
            "url": f"/static/{filename}",
            "format": extension,
            "cache_control": "public, max-age=600, stale-while-revalidate=3600",
            "sharpness_applied": sharpness if sharpness != 1.0 else None,
            "sharpness_method": "unsharp_mask",
            "original_mode": image.mode,
            "final_mode": image.mode,
            "has_transparency": image.mode in ('RGBA', 'LA') and 
                              any(alpha < 255 for alpha in image.getchannel('A').getdata()) 
                              if image.mode in ('RGBA', 'LA') else False
        })
        
    except Exception as e:
        raise HTTPException(500, detail=f"การแปลงไฟล์ล้มเหลว: {str(e)}")





# @router.post("/noise_reduce")
# async def reduce_noise(
#     strength: float = Form(0.0, ge=0.0, le=10.0, description="ระดับความแรงในการลด noise")
# ):
#     try:
#         # หาไฟล์ภาพที่แก้ไขล่าสุด
#         sharpen_files = glob.glob("static/sharpen*")
#         if sharpen_files:
#             latest_file = max(sharpen_files, key=os.path.getmtime)
#         else:
#             resize_files = glob.glob("static/resize*")
#             if not resize_files:
#                 raise HTTPException(404, "ไม่พบไฟล์ภาพ")
#             latest_file = max(resize_files, key=os.path.getmtime)

#         filename = os.path.basename(latest_file)
#         extension = os.path.splitext(filename)[1][1:].lower() or 'png'

#         with Image.open(latest_file) as image:
#             if image.mode == 'P':
#                 image = image.convert('RGBA')

#             has_alpha = image.mode in ('RGBA', 'LA')
#             alpha = image.getchannel('A') if has_alpha else None
#             image = image.convert('RGB')  # NLM ใช้ได้กับ BGR/RGB เท่านั้น

#             img_array = np.array(image)
#             img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)

#             if strength == 0.0:
#                 denoised_bgr = img_bgr
#             else:
#                 # ปรับพารามิเตอร์ตาม strength
#                 h = 5 + (strength * 2)  # filtering strength for luminance
#                 hColor = 4 + strength   # filtering strength for color
#                 templateWindowSize = 7
#                 searchWindowSize = 21

#                 denoised_bgr = cv2.fastNlMeansDenoisingColored(
#                     img_bgr,
#                     None,
#                     h=h,
#                     hColor=hColor,
#                     templateWindowSize=templateWindowSize,
#                     searchWindowSize=searchWindowSize
#                 )

#             denoised_rgb = cv2.cvtColor(denoised_bgr, cv2.COLOR_BGR2RGB)
#             processed = Image.fromarray(denoised_rgb)

#             if has_alpha and alpha is not None:
#                 processed = processed.convert('RGBA')
#                 processed.putalpha(alpha)

#             timestamp = int(time.time())
#             new_filename = f"noise_nlm_{strength:.1f}_{processed.width}x{processed.height}_{timestamp}.{extension}"
#             save_path = os.path.join("static", new_filename)

#             save_params = {}
#             if extension in ['jpg', 'jpeg']:
#                 save_params['quality'] = 85
#                 if processed.mode == 'RGBA':
#                     processed = processed.convert('RGB')
#             elif extension == 'webp':
#                 save_params['quality'] = 85

#             processed.save(save_path, **save_params)

#         cleanup_old_files("static", "noise_nlm")

#         return JSONResponse({
#             "filename": new_filename,
#             "url": f"/static/{new_filename}",
#             "extension": extension,
#             "strength": strength,
#             "message": f"ลด noise (NLM) ด้วย strength {strength:.1f} สำเร็จ"
#         })

#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(500, f"ลด noise ล้มเหลว: {str(e)}")


##############################################################################################################
# @router.post("/enhance_image")
# async def enhance_image(
#     noise_reduction: float = Form(0.0, ge=0.0, le=10.0, description="ความแรงของการลด noise (0.0-10.0) - 0=ไม่ลด noise, 1-3=ลดน้อย, 3-5=ลดปานกลาง, 5-10=ลดมาก"),
#     auto_detect: bool = Form(True, description="ตรวจสอบอัตโนมัติว่าภาพมี noise มากหรือไม่")
# ):
#     """
#     ปรับปรุงภาพโดยรวม: ลด noise และทำให้ภาพเรียบเนียนด้วย Median Filter
#     - ใช้ Median Filter ทั้งหมดสำหรับการประมวลผล
#     - ถ้า auto_detect=True: จะวิเคราะห์ภาพและเลือก kernel size ที่เหมาะสม
#     - ถ้า auto_detect=False: จะใช้ค่าที่ผู้ใช้ระบุใน noise_reduction
#     - รองรับภาพโปร่งใส (RGBA)
#     - เหมาะสำหรับทั้งภาพปกติและภาพที่มี noise แบบ salt-and-pepper
#     """
#     try:
#         # หาไฟล์ล่าสุดในโฟลเดอร์ static
#         source_files = glob.glob("static/resize*") + glob.glob("static/sharpen*")
#         if not source_files:
#             raise HTTPException(404, "ไม่พบไฟล์ภาพที่ขึ้นต้นด้วย 'resize' หรือ 'sharpen' ในโฟลเดอร์ static")
        
#         latest_file = max(source_files, key=os.path.getmtime)
#         filename = os.path.basename(latest_file)
#         extension = os.path.splitext(filename)[1][1:].lower() or 'png'

#         with Image.open(latest_file) as image:
#             # Convert palette images to RGBA
#             if image.mode == 'P':
#                 image = image.convert('RGBA')

#             # จัดการ alpha channel
#             has_alpha = image.mode in ('RGBA', 'LA')
#             alpha = None
            
#             if has_alpha:
#                 alpha = image.getchannel('A')
#                 image = image.convert('RGB')

#             # Convert to numpy array once for processing
#             img_array = np.array(image)

#             # ตรวจสอบอัตโนมัติว่าภาพมี noise มากหรือไม่ (ถ้าเปิดใช้งาน)
#             if auto_detect:
#                 # ใช้การวิเคราะห์ gradient เพื่อประเมิน noise
#                 gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY) if len(img_array.shape) == 3 else img_array
                
#                 # คำนวณค่าเฉลี่ยของ gradient (วัดความหยาบของภาพ)
#                 sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
#                 sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
#                 gradient_magnitude = np.sqrt(sobel_x**2 + sobel_y**2)
#                 roughness = np.mean(gradient_magnitude)
                
#                 # ปรับ kernel size อัตโนมัติตามระดับ noise
#                 if roughness > 50:  # มี noise มาก
#                     kernel_size = 7
#                     method = "auto_detect_high_noise"
#                 elif roughness > 30:  # มี noise ปานกลาง
#                     kernel_size = 5
#                     method = "auto_detect_medium_noise"
#                 else:  # มี noise น้อยหรือไม่มี
#                     kernel_size = 3
#                     method = "auto_detect_low_noise"
#             else:
#                 # คำนวณ kernel size จาก noise_reduction
#                 base_size = int(noise_reduction * 2)
#                 kernel_size = max(3, min(11, base_size if base_size % 2 != 0 else base_size + 1))
#                 method = "manual_setting"

#             # ใช้ median filter จาก OpenCV สำหรับ noise reduction
#             processed_array = cv2.medianBlur(img_array, kernel_size)
#             processed = Image.fromarray(processed_array)
#             action = "noise_reduction"

#             # คืนค่า alpha channel ถ้ามี
#             if has_alpha and alpha is not None:
#                 processed = processed.convert('RGBA')
#                 processed.putalpha(alpha)

#             # บันทึกไฟล์
#             timestamp = int(time.time())
#             new_filename = f"enhanced_{noise_reduction:.1f}_{processed.width}x{processed.height}_{timestamp}.{extension}"
#             save_path = os.path.join("static", new_filename)

#             # ตั้งค่าการบันทึกตามประเภทไฟล์
#             save_params = {}
#             if extension in ['jpg', 'jpeg']:
#                 save_params['quality'] = 85
#                 if processed.mode == 'RGBA':
#                     processed = processed.convert('RGB')
#             elif extension == 'webp':
#                 save_params['quality'] = 85
#             elif extension == 'png':
#                 save_params['compress_level'] = 6

#             processed.save(save_path, **save_params)

#         # ลบไฟล์เก่า
#         cleanup_old_files("static", "enhanced")

#         return JSONResponse({
#             "filename": new_filename,
#             "url": f"/static/{new_filename}",
#             "extension": extension,
#             "noise_reduction": noise_reduction,
#             "kernel_size": kernel_size,
#             "method": method,
#             "action": action,
#             "has_alpha": has_alpha,
#             "auto_detect": auto_detect,
#             "message": f"ปรับปรุงภาพสำเร็จ: {action} (kernel size: {kernel_size})"
#         })

#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(500, f"การปรับปรุงภาพล้มเหลว: {str(e)}")

# @router.post("/sharpen")
# async def sharpen_image(
#     sharpness: float = Form(0.0, ge=-2.0, le=2.0)  # รับค่า sharpness (-2 ถึง 2)
# ):
#     """
#     ปรับความคมชัดของภาพตามค่า sharpness (-2 ถึง 2)
#     - ค่าลบ = ลดความคมชัด (blur)
#     - ค่าบวก = เพิ่มความคมชัด (sharpen)
#     """
#     try:
#         # หาไฟล์ล่าสุดในโฟลเดอร์ static ที่ขึ้นต้นด้วย "resize"
#         resize_files = glob.glob("static/resize*")
#         if not resize_files:
#             raise HTTPException(404, "ไม่พบไฟล์ภาพที่ขึ้นต้นด้วย 'resize' ในโฟลเดอร์ static")
        
#         latest_file = max(resize_files, key=os.path.getmtime)
#         filename = os.path.basename(latest_file)

#         # คำนวณพารามิเตอร์จากค่า sharpness
#         params = calculate_sharpness_params(sharpness)

#         # เปิดภาพจากไฟล์
#         with Image.open(latest_file) as image:
#             # ประมวลผลภาพตามค่า sharpness
#             if params['use_blur']:
#                 # ลดความคมชัดด้วย Gaussian Blur
#                 processed = image.filter(ImageFilter.GaussianBlur(radius=params['radius']))
#             else:
#                 # เพิ่มความคมชัดด้วย Unsharp Mask
#                 processed = image.filter(ImageFilter.UnsharpMask(
#                     radius=params['radius'],
#                     percent=params['percent'],
#                     threshold=params['threshold']
#                 ))

#             # สร้างชื่อไฟล์ใหม่
#             extension = os.path.splitext(filename)[1][1:] or 'png'
#             new_filename = f"sharpen_{int(sharpness*10)}_{image.width}x{image.height}.{extension}"
#             save_path = os.path.join("static", new_filename)

#             # บันทึกภาพที่ประมวลผลแล้ว
#             processed.save(save_path)

#         cleanup_old_files("static", "sharpen")

#         return JSONResponse({
#             "filename": new_filename,
#             "url": f"/static/{new_filename}",
#             "cache_control": "public, max-age=600, stale-while-revalidate=3600",
#             "used_extension": extension,
#             "sharpness": sharpness,
#             "params": params  # ส่งกลับพารามิเตอร์ที่ใช้สำหรับ debug
#         })

#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(500, f"การปรับความคมชัดภาพล้มเหลว: {str(e)}")

# @router.post("/sharpen")
# async def sharpen_image(
#     radius: Optional[float] = Form(2.0),
#     percent: Optional[int] = Form(150),
#     threshold: Optional[int] = Form(3)
# ):
#     """
#     เพิ่มความคมชัดให้ภาพโดยใช้ UnsharpMask
#     - ดึงไฟล์ภาพล่าสุดจากโฟลเดอร์ static ที่มีชื่อขึ้นต้นด้วย "resize"
#     - radius: รัศมีของ filter
#     - percent: ความแรงของ sharpening (0-500)
#     - threshold: ความแตกต่างของ pixel ที่จะถูก sharpen
#     """
#     try:
#         # หาไฟล์ล่าสุดในโฟลเดอร์ static ที่ขึ้นต้นด้วย "resize"
#         resize_files = glob.glob("static/resize*")
#         if not resize_files:
#             raise HTTPException(404, "ไม่พบไฟล์ภาพที่ขึ้นต้นด้วย 'resize' ในโฟลเดอร์ static")
        
#         # เรียงลำดับไฟล์ตามเวลาที่แก้ไข (ล่าสุดมาก่อน)
#         latest_file = max(resize_files, key=os.path.getmtime)
#         filename = os.path.basename(latest_file)

#         # เปิดภาพจากไฟล์
#         with Image.open(latest_file) as image:
#             from PIL import ImageFilter

#             # ใช้ UnsharpMask
#             sharpened = image.filter(ImageFilter.UnsharpMask(radius=radius, percent=percent, threshold=threshold))

#             # สร้างชื่อไฟล์ใหม่
#             extension = os.path.splitext(filename)[1][1:] or 'png'
#             new_filename = generate_filename("sharpen", image.width, image.height, extension)
#             save_path = os.path.join("static", new_filename)

#             # บันทึกภาพที่ sharpen แล้ว
#             sharpened.save(save_path)

#         # ลบไฟล์เก่า ยกเว้นล่าสุด
#         cleanup_old_files("static", "sharpen")

#         return JSONResponse({
#             "filename": new_filename,
#             "url": f"/static/{new_filename}",
#             "cache_control": "public, max-age=600, stale-while-revalidate=3600",
#             "used_extension": extension,
#             "source_image": filename  # เพิ่มข้อมูลไฟล์ต้นทาง
#         })

#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(500, f"การ sharpen ภาพล้มเหลว: {str(e)}")