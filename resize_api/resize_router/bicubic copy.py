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

@router.post("/")
async def resize_image(
    file: UploadFile = File(...),
    width: int = Form(...),
    height: int = Form(...),
    target_format: Optional[str] = Form(None)
):
    """Resize ภาพและแปลงรูปแบบ"""
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
            # Resize ภาพ
            resized = image.resize((width, height), Image.BICUBIC)
            
            # แปลงโหมดสีหากต้องการบันทึกเป็น JPEG หรือ BMP
            if extension in ['jpg', 'jpeg']:
                if resized.mode in ('RGBA', 'LA'):
                    background = Image.new('RGB', resized.size, (255, 255, 255))
                    background.paste(resized, mask=resized.split()[-1])
                    resized = background
                elif resized.mode == 'P':
                    resized = resized.convert('RGB')
                elif resized.mode not in ('RGB', 'L'):
                    resized = resized.convert('RGB')
            elif extension == 'bmp' and resized.mode == 'RGBA':
                # BMP ไม่รองรับ RGBA ให้แปลงเป็น RGB
                background = Image.new('RGB', resized.size, (255, 255, 255))
                background.paste(resized, mask=resized.split()[-1])
                resized = background

            # บันทึกไฟล์
            filename = generate_filename("bicubic", width, height, extension)
            save_path = os.path.join("static", filename)
            resized.save(save_path)

        cleanup_old_files("static", "bicubic")

        return JSONResponse({
            "filename": filename,
            "url": f"/static/{filename}",
            "cache_control": "public, max-age=600, stale-while-revalidate=3600",
            "source_extension": ALLOWED_CONTENT_TYPES.get(file.content_type),
            "used_extension": extension
        })
        
    except Exception as e:
        raise HTTPException(500, f"การประมวลผลภาพล้มเหลว: {str(e)}")

@router.post("/convert")
async def convert_image(
    file: UploadFile = File(...),
    target_format: str = Form(...),
    width: Optional[int] = Form(None),
    height: Optional[int] = Form(None)
):
    """แปลงรูปแบบไฟล์ภาพ"""
    try:
        # ตรวจสอบและอ่านไฟล์
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
            raise HTTPException(400, "รูปแบบไฟล์ปลายทางไม่รองรับ")

        # เปิดภาพ
        image = Image.open(BytesIO(contents))
        
        # ปรับขนาดหากระบุ
        if width and height:
            image = image.resize((width, height), Image.BICUBIC)
            
        # แปลงโหมดสีหากต้องการบันทึกเป็น JPEG
        output_format = format_mapping[target_format]
        if output_format == 'JPEG':
            if image.mode in ('RGBA', 'LA'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                background.paste(image, mask=image.split()[-1])
                image = background
            elif image.mode == 'P':
                image = image.convert('RGB')
            elif image.mode not in ('RGB', 'L'):
                image = image.convert('RGB')
        
        # สร้างไฟล์ผลลัพธ์
        output_buffer = BytesIO()
        save_params = {}
        
        if output_format in ['JPEG', 'WEBP']:
            save_params['quality'] = 85
        elif output_format == 'TIFF':
            save_params['compression'] = 'tiff_deflate'
        
        image.save(output_buffer, format=output_format, **save_params)
        output_buffer.seek(0)
        
        # สร้างชื่อไฟล์
        extension_map = {
            'JPEG': 'jpg',
            'PNG': 'png',
            'WEBP': 'webp',
            'BMP': 'bmp',
            'TIFF': 'tiff'
        }
        extension = extension_map.get(output_format, target_format)
        
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
        })
        
    except Exception as e:
        raise HTTPException(500, f"การแปลงไฟล์ล้มเหลว: {str(e)}")