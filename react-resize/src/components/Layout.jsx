import { Link, useNavigate, Outlet } from 'react-router-dom';
import { useState } from 'react';
import {
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

const Layout = () => {
const navigate = useNavigate();
const [isLoggingOut, setIsLoggingOut] = useState(false);
const [logoutError, setLogoutError] = useState(null);

const handleLogout = async (event) => {
  event.preventDefault();
  setIsLoggingOut(true);
  setLogoutError(null);

  try {
    const response = await fetch('http://localhost:3333/logout', {
      method: 'POST',
      credentials: 'include', // ✅ สำคัญมากสำหรับ session-based auth
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Logout failed');
    }

    navigate('/login', { replace: true });
  } catch (error) {
    setLogoutError(error.message);
    console.error('Logout error:', error);
  } finally {
    setIsLoggingOut(false);
  }
};


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Navigation Buttons */}
            <div className="flex items-center space-x-6">
              <Link
                to="/dashboard"
                className="text-gray-600 hover:text-black text-sm font-medium"
              >
                Dashboard
              </Link>

              <Link
                to="/user-management"
                className="text-gray-600 hover:text-black text-sm font-medium"
              >
                User Management
              </Link>

            </div>

            {/* Logout Button */}
            <div className="flex items-center ml-auto mr-10 space-x-6">
              <Link
                to="/"
                className="text-gray-600 hover:text-black text-sm font-medium"
              >
                Resize App
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              {logoutError && (
                <div className="flex items-center text-red-600 text-sm">
                  <ExclamationTriangleIcon className="h-5 w-5 mr-1" />
                  {logoutError}
                </div>
              )}
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition ${
                  isLoggingOut
                    ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {isLoggingOut ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                    Logging out...
                  </>
                ) : (
                  'Logout'
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
