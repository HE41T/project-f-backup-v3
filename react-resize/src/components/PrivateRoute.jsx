import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import axios from 'axios';

const PrivateRoute = ({ allowedRoles = [] }) => {
  const [authStatus, setAuthStatus] = useState({ loading: true, allowed: false });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await axios.get('http://localhost:3333/auth/check', {
          withCredentials: true,
        });

        const user = response.data.user;
        if (allowedRoles.length === 0 || allowedRoles.includes(user.role)) {
          setAuthStatus({ loading: false, allowed: true });
        } else {
          setAuthStatus({ loading: false, allowed: false });
        }
      } catch (error) {
        setAuthStatus({ loading: false, allowed: false });
      }
    };

    checkAuth();
  }, [allowedRoles]);

  if (authStatus.loading) return <div>Loading...</div>;

  if (!authStatus.allowed) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default PrivateRoute;
