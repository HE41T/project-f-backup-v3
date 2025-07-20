import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout'; // ✅ import Layout
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import UserManagement from './pages/UserManagement';
import UserStatus from './pages/UserStatus'; // import component ใหม่

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        {/* Protected Layout */}
        <Route element={<PrivateRoute allowedRoles={['admin', 'superuser']} />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} /> {/* ✅ หน้า Dashboard */}
            <Route path="/user-management" element={<UserManagement />} />
            <Route path="/user-status" element={<UserStatus />} />  {/* เพิ่มบรรทัดนี้ */}
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
