import { Navigate, Outlet } from 'react-router-dom';

const PrivateRoute = ({ allowedRoles = [] }) => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // ในทางปฏิบัติควร decode token เพื่อตรวจสอบ role
  // แต่เราจะตรวจสอบที่ API endpoint แทน
  return <Outlet />;
};

export default PrivateRoute;