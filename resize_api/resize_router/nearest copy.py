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