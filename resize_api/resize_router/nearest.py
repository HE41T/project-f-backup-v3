import os
import time
from io import BytesIO
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
import pillow_heif
from PIL import Image, ImageFilter
import shutil
from pathlib import Path
import glob

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

def calculate_sharpness_params(sharpness: float):
    """คำนวณค่า radius, percent, threshold จากค่า sharpness (-2 ถึง 2)"""
    if sharpness == 0:
        # ไม่ทำการปรับเปลี่ยนภาพ (no operation)
        return {
            'use_blur': False,
            'radius': 0,  # ไม่มี radius เมื่อไม่ประมวลผล
            'percent': 0,  # 0% = ไม่เปลี่ยนค่า
            'threshold': 0  # ไม่มี threshold
        }
    elif sharpness < 0:
        # Gaussian Blur เมื่อต้องการลดความคมชัด
        radius = abs(sharpness) * 2  # 0 ถึง 4
        return {
            'use_blur': True,
            'radius': radius,
            'percent': 0,
            'threshold': 0
        }
    else:
        # Unsharp Mask เมื่อต้องการเพิ่มความคมชัด
        radius = 1.0 + (sharpness * 0.5)  # ปรับให้ radius เริ่มที่ 1.0 แทน 2.0 (เพื่อความ natural)
        percent = 100 + int(sharpness * 50)  # 100% ถึง 200% (ลดความแรงจากเดิม)
        threshold = max(0, 3 - int(sharpness * 1.5))  # 3 ถึง 0 (ปรับเกณฑ์ให้ละเอียดขึ้น)
        return {
            'use_blur': False,
            'radius': radius,
            'percent': percent,
            'threshold': threshold
        }

def generate_filename(prefix: str, width: int, height: int, extension: str):
    """สร้างชื่อไฟล์แบบมี timestamp เพื่อป้องกัน cache"""
    timestamp = int(time.time())
    return f"{prefix}_{width}x{height}_{timestamp}.{extension}"

def cleanup_old_files(directory: str, prefix: str, keep_latest: int = 1):
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
            resized = image.resize((width, height), Image.NEAREST)
            
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
            filename = generate_filename("resize", width, height, extension)
            save_path = os.path.join("static", filename)
            resized.save(save_path)

        cleanup_old_files("static", "resize")

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
            image = image.resize((width, height), Image.BILINEAR)
            
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

@router.post("/sharpen")
async def sharpen_image(
    sharpness: float = Form(0.0, ge=-2.0, le=2.0)  # รับค่า sharpness (-2 ถึง 2)
):
    """
    ปรับความคมชัดของภาพตามค่า sharpness (-2 ถึง 2)
    - ค่าลบ = ลดความคมชัด (blur)
    - ค่าบวก = เพิ่มความคมชัด (sharpen)
    - 0 = ไม่ทำอะไร
    - รองรับภาพโปร่งใส (RGBA)
    """
    try:
        # หาไฟล์ล่าสุดในโฟลเดอร์ static ที่ขึ้นต้นด้วย "resize"
        resize_files = glob.glob("static/resize*")
        if not resize_files:
            raise HTTPException(404, "ไม่พบไฟล์ภาพที่ขึ้นต้นด้วย 'resize' ในโฟลเดอร์ static")
        
        latest_file = max(resize_files, key=os.path.getmtime)
        filename = os.path.basename(latest_file)
        extension = os.path.splitext(filename)[1][1:].lower() or 'png'

        # คำนวณพารามิเตอร์จากค่า sharpness
        params = calculate_sharpness_params(sharpness)

        # เปิดภาพจากไฟล์
        with Image.open(latest_file) as image:
            if image.mode == 'P':
                image = image.convert('RGBA')  # ป้องกัน palette-based

            # ตรวจสอบว่ามีช่อง alpha (พื้นหลังโปร่งใส)
            has_alpha = image.mode in ('RGBA', 'LA')
            alpha = None
            
            if has_alpha:
                # แยก alpha ออกมาเก็บไว้
                alpha = image.getchannel('A')
                # แปลงภาพเป็น RGB ชั่วคราวเพื่อ sharpen
                image = image.convert('RGB')


            # >>> ทำ sharpen หรือ blur ตามค่าที่ได้รับ
            if params['use_blur']:
                processed = image.filter(ImageFilter.GaussianBlur(radius=params['radius']))
            elif sharpness > 0:
                processed = image.filter(ImageFilter.UnsharpMask(
                    radius=params['radius'],
                    percent=params['percent'],
                    threshold=params['threshold']
                ))
            else:
                processed = image

            # หลังประมวลผลเสร็จ → เอา alpha กลับมา
            if has_alpha and alpha is not None:
                processed = processed.convert('RGBA')
                processed.putalpha(alpha)
                # บังคับ convert RGB หากไม่รองรับ alpha

            # สร้างชื่อไฟล์ใหม่
            timestamp = int(time.time())
            new_filename = f"sharpen_{int(sharpness*10)}_{processed.width}x{processed.height}_{timestamp}.{extension}"
            save_path = os.path.join("static", new_filename)

            # ตั้งค่าการบันทึกตามประเภทไฟล์
            save_params = {}
            if extension in ['jpg', 'jpeg']:
                save_params['quality'] = 85
                if processed.mode == 'RGBA':
                    processed = processed.convert('RGB')  # JPEG ไม่รองรับ alpha
            elif extension == 'webp':
                save_params['quality'] = 85
                # WebP รองรับ RGBA ได้
            elif extension == 'png':
                pass  # PNG รองรับ RGBA โดยตรง
            else:
                # fallback เพื่อความปลอดภัย
                if processed.mode == 'RGBA':
                    processed = processed.convert('RGBA')

            # บันทึกภาพที่ประมวลผลแล้ว
            processed.save(save_path, **save_params)

        # ลบไฟล์เก่า (เก็บไว้ล่าสุด 3 ไฟล์)
        cleanup_old_files("static", "sharpen")

        return JSONResponse({
            "filename": new_filename,
            "url": f"/static/{new_filename}",
            "cache_control": "public, max-age=600, stale-while-revalidate=3600",
            "extension": extension,
            "sharpness": sharpness,
            "source_filename": filename,
            "has_alpha": has_alpha,
            "image_mode": processed.mode,
            "params": params  # สำหรับ debug
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"การปรับความคมชัดภาพล้มเหลว: {str(e)}")

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