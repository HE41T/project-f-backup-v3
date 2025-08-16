import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import FileUploader from './FileUploader';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/LoginPage';
import UserManagement from './pages/UserManagement';
import RegisterForm from './components/RegisterForm';
import ResetPassword from './components/ResetPassword';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterForm />} />
        
        {/* Home page - FileUploader */}
        <Route 
          path="/" 
          element={
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
              <FileUploader />
            </div>
          } 
        />
        <Route path="/reset-password" element={<ResetPassword />} />
        
        {/* Protected routes with Layout */}
        <Route element={<PrivateRoute allowedRoles={['admin', 'superuser']} />}>
          <Route element={<Layout />}>
            {/* Dashboard is the default page after login */}
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/user-management" element={<UserManagement />} />
            
            {/* Redirect to dashboard when accessing / */}
            <Route 
              path="/" 
              element={<Navigate to="/dashboard" replace />} 
            />
          </Route>
        </Route>
        
        {/* Default redirect to home if not logged in, or dashboard if logged in */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;