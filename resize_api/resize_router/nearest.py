import os
import time
from io import BytesIO
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional
import pillow_heif
from PIL import Image, ImageFilter, features
import shutil
from pathlib import Path
import glob
import numpy as np
import cv2

router = APIRouter()

# Config
MAX_FILE_SIZE_MB = 10
ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
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
    content_type = file.content_type
    if content_type not in ALLOWED_CONTENT_TYPES:
        # ตรวจสอบจากนามสกุลไฟล์หาก content-type ไม่ตรง
        file_extension = file.filename.split('.')[-1].lower()
        if file_extension in ALLOWED_CONTENT_TYPES.values():
            content_type = f"image/{file_extension}"
            if file_extension == 'jpg':
                content_type = 'image/jpeg'
        
        if content_type not in ALLOWED_CONTENT_TYPES:
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
    """Resize ภาพและแปลงรูปแบบ (เวอร์ชันรองรับ WebP ทุกประเภท)"""
    try:
        contents = await file.read()  # อ่านไฟล์ทั้งหมด
        
        # ตรวจสอบไฟล์ WebP แบบไม่เข้มงวดเกินไป
        if file.content_type == 'image/webp':
            if not contents[:4] == b'RIFF' or not contents[8:12] == b'WEBP':
                print("⚠️ ไฟล์ WebP มีรูปแบบ header ไม่มาตรฐาน แต่จะพยายามประมวลผลต่อไป")

        # กำหนดนามสกุลไฟล์ผลลัพธ์
        extension = target_format.lower() if target_format else ALLOWED_CONTENT_TYPES.get(file.content_type, 'webp')

        # เปิดภาพด้วย Pillow ด้วยการจัดการข้อผิดพลาดเฉพาะ
        try:
            image = Image.open(BytesIO(contents))
            
            # แปลงโหมดสีสำหรับ WebP โดยไม่ขึ้นกับ mode เดิม
            if image.format == 'WEBP':
                if image.mode == 'P':
                    image = image.convert('RGBA')
                elif image.mode == 'LA':
                    image = image.convert('RGBA')
                elif image.mode == 'L':
                    image = image.convert('RGB')
            
            image.load()  # บังคับโหลดข้อมูล
        except Exception as e:
            raise HTTPException(400, f"ไม่สามารถเปิดไฟล์ภาพได้: {str(e)}")

        # Resize ภาพ
        resized = image.resize((width, height), Image.NEAREST)

        # จัดการโหมดสีก่อนบันทึก
        if extension == 'webp':
            # ไม่บังคับแปลงโหมดสีสำหรับ WebP
            pass
        elif extension in ['jpg', 'jpeg']:
            if resized.mode in ('RGBA', 'LA'):
                background = Image.new('RGB', resized.size, (255, 255, 255))
                background.paste(resized, mask=resized.split()[-1])
                resized = background
            elif resized.mode not in ('RGB', 'L'):
                resized = resized.convert('RGB')

        # ตั้งค่าการบันทึกไฟล์
        filename = generate_filename("resize", width, height, extension)
        save_path = os.path.join("static", filename)
        save_params = {}

        # การตั้งค่าเฉพาะสำหรับ WebP
        if extension == 'webp':
            save_params.update({
                'method': 4,
                'quality': 85,
                'lossless': False
            })
            
            # ลองบันทึกด้วยวิธีต่างๆ หากวิธีหลักล้มเหลว
            try:
                resized.save(save_path, **save_params)
            except:
                try:
                    # ลองบันทึกแบบ RGB หาก RGBA ล้มเหลว
                    if resized.mode == 'RGBA':
                        temp_img = resized.convert('RGB')
                        temp_img.save(save_path, **save_params)
                    else:
                        raise
                except:
                    # ลองบันทึกแบบไม่มีพารามิเตอร์
                    resized.save(save_path)

        else:
            # การตั้งค่าสำหรับรูปแบบอื่น
            if extension in ['jpg', 'jpeg']:
                save_params['quality'] = 85
            resized.save(save_path, **save_params)

        cleanup_old_files("static", "resize")

        return JSONResponse({
            "filename": filename,
            "url": f"/static/{filename}",
            "source_extension": ALLOWED_CONTENT_TYPES.get(file.content_type),
            "used_extension": extension,
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"การประมวลผลภาพล้มเหลว: {str(e)}")


@router.post("/convert")
async def convert_image(
    file: UploadFile = File(...),
    target_format: str = Form(...),
    width: Optional[int] = Form(None),
    height: Optional[int] = Form(None),
    quality: Optional[int] = Form(85)  # เพิ่มพารามิเตอร์คุณภาพ
):
    """แปลงรูปแบบไฟล์ภาพ"""
    try:
        contents = await file.read()

        # แปลงชื่อรูปแบบ
        format_mapping = {
            'jpg': 'JPEG',
            'jpeg': 'JPEG',
            'png': 'PNG',
            'webp': 'WEBP',
        }

        target_format = target_format.lower()
        if target_format not in format_mapping:
            raise HTTPException(400, "รูปแบบไฟล์ปลายทางไม่รองรับ")

        output_format = format_mapping[target_format]

        # เปิดภาพด้วย Pillow
        try:
            image = Image.open(BytesIO(contents))
            # สำหรับไฟล์ WebP
            if image.format == 'WEBP' and image.mode == 'P':
                image = image.convert('RGBA')
            image.load()
        except Exception as e:
            raise HTTPException(400, f"ไม่สามารถเปิดภาพได้: {str(e)}")

        # Resize ถ้ามี
        if width and height:
            image = image.resize((width, height), Image.NEAREST)

        # แปลงโหมดสีสำหรับ JPEG
        if output_format == 'JPEG':
            if image.mode in ('RGBA', 'LA'):
                background = Image.new('RGB', image.size, (255, 255, 255))
                background.paste(image, mask=image.split()[-1])
                image = background
            elif image.mode not in ('RGB', 'L'):
                image = image.convert('RGB')

        # สำหรับ WebP ให้ตรวจสอบโหมดสี
        if output_format == 'WEBP' and image.mode == 'P':
            image = image.convert('RGBA')

        # Save
        output_buffer = BytesIO()
        save_params = {}
        if output_format in ['JPEG', 'WEBP']:
            save_params['quality'] = quality  # ใช้ค่าคุณภาพที่ผู้ใช้กำหนด
        elif output_format == 'TIFF':
            save_params['compression'] = 'tiff_deflate'

        # สำหรับ WebP สามารถตั้งค่าเพิ่มเติมได้เช่น
        if output_format == 'WEBP':
            save_params['method'] = 6  # ค่า default ของ Pillow สำหรับการเข้ารหัส WebP

        image.save(output_buffer, format=output_format, **save_params)
        output_buffer.seek(0)

        extension_map = {
            'JPEG': 'jpg',
            'PNG': 'png',
            'WEBP': 'webp',
        }
        extension = extension_map.get(output_format, target_format)

        filename = generate_filename("converted", image.width, image.height, extension)
        save_path = os.path.join("static", filename)

        with open(save_path, 'wb') as f:
            f.write(output_buffer.getvalue())

        cleanup_old_files("static", "converted")

        return JSONResponse({
            "filename": filename,
            "url": f"/static/{filename}",
            "format": extension,
            "quality": quality if output_format in ['JPEG', 'WEBP'] else None,
            "cache_control": "public, max-age=600, stale-while-revalidate=3600",
        })

    except HTTPException:
        raise
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

@router.post("/enhance_image")
async def enhance_image(
    noise_reduction: float = Form(0.0, ge=0.0, le=10.0, description="ความแรงของการลด noise (0.0-10.0) - 0=ไม่ลด noise, 1-3=ลดน้อย, 3-5=ลดปานกลาง, 5-10=ลดมาก")
):
    """
    ปรับปรุงภาพโดยรวม: ลด noise และทำให้ภาพเรียบเนียนด้วย Median Filter
    - ใช้ Median Filter ทั้งหมดสำหรับการประมวลผล
    - ใช้ค่าที่ผู้ใช้ระบุใน noise_reduction เพื่อกำหนดความแรงของการลด noise
    - รองรับภาพโปร่งใส (RGBA)
    - เหมาะสำหรับทั้งภาพปกติและภาพที่มี noise แบบ salt-and-pepper
    """
    try:
        # หาไฟล์ล่าสุดในโฟลเดอร์ static
        source_files = glob.glob("static/resize*") + glob.glob("static/sharpen*")
        if not source_files:
            raise HTTPException(404, "ไม่พบไฟล์ภาพที่ขึ้นต้นด้วย 'resize' หรือ 'sharpen' ในโฟลเดอร์ static")
        
        latest_file = max(source_files, key=os.path.getmtime)
        filename = os.path.basename(latest_file)
        extension = os.path.splitext(filename)[1][1:].lower() or 'png'

        with Image.open(latest_file) as image:
            # Convert palette images to RGBA
            if image.mode == 'P':
                image = image.convert('RGBA')

            # จัดการ alpha channel
            has_alpha = image.mode in ('RGBA', 'LA')
            alpha = None
            
            if has_alpha:
                alpha = image.getchannel('A')
                image = image.convert('RGB')

            # Convert to numpy array for processing
            img_array = np.array(image)

            # คำนวณ kernel size จาก noise_reduction
            base_size = int(noise_reduction * 2)
            kernel_size = max(3, min(11, base_size if base_size % 2 != 0 else base_size + 1))

            # ใช้ median filter จาก OpenCV สำหรับ noise reduction
            processed_array = cv2.medianBlur(img_array, kernel_size)
            processed = Image.fromarray(processed_array)
            action = "noise_reduction"

            # คืนค่า alpha channel ถ้ามี
            if has_alpha and alpha is not None:
                processed = processed.convert('RGBA')
                processed.putalpha(alpha)

            # บันทึกไฟล์
            timestamp = int(time.time())
            new_filename = f"enhanced_{noise_reduction:.1f}_{processed.width}x{processed.height}_{timestamp}.{extension}"
            save_path = os.path.join("static", new_filename)

            # ตั้งค่าการบันทึกตามประเภทไฟล์
            save_params = {}
            if extension in ['jpg', 'jpeg']:
                save_params['quality'] = 85
                if processed.mode == 'RGBA':
                    processed = processed.convert('RGB')
            elif extension == 'webp':
                save_params['quality'] = 85
            elif extension == 'png':
                save_params['compress_level'] = 6

            processed.save(save_path, **save_params)

        # ลบไฟล์เก่า
        cleanup_old_files("static", "enhanced")

        return JSONResponse({
            "filename": new_filename,
            "url": f"/static/{new_filename}",
            "extension": extension,
            "noise_reduction": noise_reduction,
            "kernel_size": kernel_size,
            "action": action,
            "has_alpha": has_alpha,
            "message": f"ปรับปรุงภาพสำเร็จ: {action} (kernel size: {kernel_size})"
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"การปรับปรุงภาพล้มเหลว: {str(e)}")
