import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [roleChange, setRoleChange] = useState({ userId: null, newRole: '' });
  const navigate = useNavigate();

  // ดึงข้อมูลผู้ใช้ทั้งหมด
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('http://localhost:3333/users', {
          method: 'GET',
          credentials: 'include', // สำคัญ! เพื่อส่ง cookie session ไปด้วย
        });

        if (response.status === 401 || response.status === 403) {
          navigate('/login');
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }

        const data = await response.json();
        setUsers(data.users);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [navigate]);

  // ฟังก์ชันเปลี่ยน Role
  const handleRoleChange = async () => {
    if (!roleChange.userId || !roleChange.newRole) return;

    try {
      const response = await fetch(`http://localhost:3333/users/${roleChange.userId}/role`, {
        method: 'PUT',
        credentials: 'include', // ส่ง cookie session ด้วย
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role: roleChange.newRole })
      });

      if (!response.ok) {
        throw new Error('Failed to update role');
      }

      setUsers(users.map(user =>
        user.id === roleChange.userId ? { ...user, role: roleChange.newRole } : user
      ));

      setRoleChange({ userId: null, newRole: '' });
    } catch (err) {
      setError(err.message);
    }
  };

  // ฟังก์ชันลบผู้ใช้
  const handleDeleteUser = async () => {
    if (!confirmDelete) return;

    try {
      const response = await fetch(`http://localhost:3333/users/${confirmDelete}`, {
        method: 'DELETE',
        credentials: 'include', // ส่ง cookie session ด้วย
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ confirm: true })
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      setUsers(users.filter(user => user.id !== confirmDelete));
      setConfirmDelete(null);
    } catch (err) {
      setError(err.message);
    }
  };

  // แสดง Modal ยืนยันการลบ
  const DeleteConfirmationModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-bold mb-4">Confirm Deletion</h3>
        <p className="mb-6">Are you sure you want to delete this user? This action cannot be undone.</p>
        <div className="flex justify-end space-x-3">
          <button 
            onClick={() => setConfirmDelete(null)}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleDeleteUser}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );

  // แสดง Modal เปลี่ยน Role
  const RoleChangeModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h3 className="text-lg font-bold mb-4">Change User Role</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Select New Role</label>
          <select
            value={roleChange.newRole}
            onChange={(e) => setRoleChange({...roleChange, newRole: e.target.value})}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="">Select Role</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
        </div>
        <div className="flex justify-end space-x-3">
          <button 
            onClick={() => setRoleChange({ userId: null, newRole: '' })}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleRoleChange}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Change Role
          </button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">User Management</h1>
      
      {/* ตารางแสดงผู้ใช้ */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {user.firstname} {user.lastname}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                    ${user.role === 'superuser' ? 'bg-purple-100 text-purple-800' : 
                      user.role === 'admin' ? 'bg-blue-100 text-blue-800' : 
                      'bg-green-100 text-green-800'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {user.role !== 'superuser' && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setRoleChange({ userId: user.id, newRole: user.role })}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Change Role
                      </button>
                      <button
                        onClick={() => setConfirmDelete(user.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* แสดง Modal เมื่อต้องการยืนยันการลบ */}
      {confirmDelete && <DeleteConfirmationModal />}

      {/* แสดง Modal เมื่อต้องการเปลี่ยน Role */}
      {roleChange.userId && <RoleChangeModal />}
    </div>
  );
};

export default UserManagement;