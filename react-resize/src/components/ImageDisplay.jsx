import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const ImageDisplay = ({
  file,
  originalFile,
  processedFile,
  showOriginal,
  fileSizeKB,
  handleFileChange,
  currentImageUrl,
}) => {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [, setLogoutError] = useState(null);
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // ✅ ตรวจสอบ session
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('http://localhost:3333/auth/check', {
          credentials: 'include',
        });
        const data = await response.json();

        if (response.ok && data.user) {
          setIsLoggedIn(true);
          setUser(data.user); // ✅ แก้ตรงนี้
        } else {
          setIsLoggedIn(false);
        }
      } catch (err) {
        console.error('Error checking auth:', err);
        setIsLoggedIn(false);
      }
    };

    checkSession();
  }, []);

  // ✅ Logout
  const handleLogout = async (event) => {
    event.preventDefault();
    setIsLoggingOut(true);
    setLogoutError(null);

    try {
      const response = await fetch('http://localhost:3333/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.message || 'Logout failed');

      setIsLoggedIn(false);
      navigate('/login', { replace: true });
    } catch (error) {
      setLogoutError(error.message);
      console.error('Logout error:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  // ✅ ปิด dropdown เมื่อคลิกนอก
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const getStatusText = () => {
    if (showOriginal) return 'ต้นฉบับ';
    if (!processedFile) return 'หลังปรับขนาด';
    return 'รูปหลังปรับปรุง';
  };

  const getImageUrl = () => {
    if (showOriginal) {
      return originalFile ? URL.createObjectURL(originalFile) : '';
    }
    return currentImageUrl || '';
  };

  const handleImageLoad = (e) => {
    if (e.target.src.startsWith('blob:')) {
      URL.revokeObjectURL(e.target.src);
    }
  };

  const handleImageError = (e) => {
    console.error('Failed to load image:', e.target.src);
  };

  return (
    <div className="
      md:static md:inset-auto
      fixed inset-0
      col-span-4 md:col-span-3 
      row-span-5 p-4 flex flex-col 
      bg-[#171719] border-r border-[#24262B]/50
    ">
      {/* ✅ Navbar */}
      <nav className="w-full bg-[#121212] text-white px-6 py-3 rounded-lg mb-4 shadow-lg flex justify-between items-center">
        <div className="text-xl font-semibold text-[#00B4CC]">Resize App</div>
        <div className="relative" ref={dropdownRef}>
          {isLoggedIn && user ? (
            <>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="text-white hover:text-[#00B4CC] font-medium"
              >
                {user.firstname} {user.lastname} ▾
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[#1f1f1f] rounded-md shadow-lg z-50 border border-[#333]">
                  {/* เพิ่มปุ่ม Dashboard สำหรับ admin หรือ superuser */}
                  {(user.role === 'admin' || user.role === 'superuser') && (
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        navigate('/dashboard');
                      }}
                      className="block w-full text-left px-4 py-2 hover:bg-[#2c2c2c] text-[#00B4CC]"
                    >
                      📊 Go Dashboard
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate('/reset-password');
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-[#2c2c2c]"
                  >
                    🔐 Reset Password
                  </button>
                  <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="block w-full text-left px-4 py-2 hover:bg-[#2c2c2c] text-red-400"
                  >
                    🚪 {isLoggingOut ? 'กำลังออก...' : 'Logout'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="bg-[#00969D] hover:bg-[#007980] text-white px-4 py-1 rounded transition-all"
            >
              Login
            </button>
          )}
        </div>
      </nav>

      {/* Upload */}
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
                key={currentImageUrl}
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




// import React, { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';

// const ImageDisplay = ({
//   file,
//   originalFile,
//   processedFile,
//   showOriginal,
//   fileSizeKB,
//   handleFileChange,
//   currentImageUrl,
// }) => {
//   const navigate = useNavigate();

//   const [isLoggedIn, setIsLoggedIn] = useState(false);
//   const [isLoggingOut, setIsLoggingOut] = useState(false);
//   const [logoutError, setLogoutError] = useState(null);
//   const [user, setUser] = useState(null); // 🧍‍♂️ เก็บชื่อ user
//   const [dropdownOpen, setDropdownOpen] = useState(false);

//   // ✅ ตรวจสอบ session login
//   useEffect(() => {
//     const checkSession = async () => {
//       try {
//         const response = await fetch('http://localhost:3333/auth/check', {
//           credentials: 'include',
//         });
//         const data = await response.json();

//         if (response.ok && data.user) {
//           setIsLoggedIn(true);
//         } else {
//           setIsLoggedIn(false);
//         }
//       } catch (err) {
//         console.error('Error checking auth:', err);
//         setIsLoggedIn(false);
//       }
//     };

//     checkSession();
//   }, []);

//   // ✅ ฟังก์ชัน Logout
//   const handleLogout = async (event) => {
//     event.preventDefault();
//     setIsLoggingOut(true);
//     setLogoutError(null);

//     try {
//       const response = await fetch('http://localhost:3333/logout', {
//         method: 'POST',
//         credentials: 'include',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//       });

//       const data = await response.json();

//       if (!response.ok) {
//         throw new Error(data.message || 'Logout failed');
//       }

//       setIsLoggedIn(false);
//       navigate('/login', { replace: true });
//     } catch (error) {
//       setLogoutError(error.message);
//       console.error('Logout error:', error);
//     } finally {
//       setIsLoggingOut(false);
//     }
//   };

//   // ✅ คำอธิบายสถานะรูป
//   const getStatusText = () => {
//     if (showOriginal) return 'ต้นฉบับ';
//     if (!processedFile) return 'หลังปรับขนาด';
//     return 'รูปหลังปรับปรุง';
//   };

//   // ✅ ดึง URL รูปภาพ
//   const getImageUrl = () => {
//     if (showOriginal) {
//       return originalFile ? URL.createObjectURL(originalFile) : '';
//     }
//     return currentImageUrl || '';
//   };

//   const handleImageLoad = (e) => {
//     if (e.target.src.startsWith('blob:')) {
//       URL.revokeObjectURL(e.target.src);
//     }
//   };

//   const handleImageError = (e) => {
//     console.error('Failed to load image:', e.target.src);
//   };

//   const toggleDropdown = () => {
//     setDropdownOpen(!dropdownOpen);
//   };

//   return (
//     <div className="
//       md:static md:inset-auto
//       fixed inset-0
//       col-span-4 md:col-span-3 
//       row-span-5 p-4 flex flex-col 
//       bg-[#171719] border-r border-[#24262B]/50
//     ">
//       {/* Navbar */}
//       <nav className="w-full bg-[#121212] text-white px-6 py-3 rounded-lg mb-4 shadow-lg flex justify-between items-center">
//         <div className="text-xl font-semibold text-[#00B4CC]">Resize App</div>
//         <div>
//           {isLoggedIn ? (
//             <button
//               onClick={handleLogout}
//               disabled={isLoggingOut}
//               className="bg-[#e06c75] hover:bg-[#c85b63] text-white px-4 py-1 rounded transition-all"
//             >
//               {isLoggingOut ? 'กำลังออก...' : 'Logout'}
//             </button>
//           ) : (
//             <button
//               onClick={() => navigate('/login')}
//               className="bg-[#00969D] hover:bg-[#007980] text-white px-4 py-1 rounded transition-all"
//             >
//               Login
//             </button>
//           )}
//         </div>
//       </nav>

//       {/* Upload */}
//       <div className="flex justify-center">
//         <label
//           htmlFor="image-upload"
//           className="inline-block bg-[#00969D] text-white px-20 py-2 rounded-lg cursor-pointer 
//                    hover:bg-[#007980] transition-all shadow-md hover:shadow-lg active:scale-95"
//         >
//           เลือกรูปภาพ
//         </label>
//         <input
//           id="image-upload"
//           type="file"
//           accept="image/jpeg,image/png,image/webp"
//           onChange={handleFileChange}
//           className="hidden"
//         />
//       </div>

//       {(file || processedFile) && (
//         <>
//           <div className="flex justify-between items-center mt-4 mb-1">
//             <h3 className="font-bold text-[#00969D] text-2xl">
//               {getStatusText()}
//             </h3>
//             <div className="font-bold text-[#e06c75] text-medium">
//               ภาพมีปัญหาให้กดปรับขนาด
//             </div>
//           </div>

//           <div className="flex-1 flex items-center justify-center overflow-hidden rounded-lg bg-[#24262B] border border-[#292C31]">
//             {getImageUrl() && (
//               <img
//                 key={currentImageUrl}
//                 src={getImageUrl()}
//                 alt={showOriginal ? 'original' : 'processed'}
//                 className="object-contain max-h-full max-w-full"
//                 onLoad={handleImageLoad}
//                 onError={handleImageError}
//               />
//             )}
//           </div>
//         </>
//       )}
//     </div>
//   );
// };

// export default ImageDisplay;
