import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const RegisterForm = () => {
  const [form, setForm] = useState({
    email: '',
    passwords: '',
    firstname: '',
    lastname: '',
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      const response = await axios.post('http://localhost:3333/register', form);
      if (response.data.status === 'ok') {
        setMessage('✅ สมัครสมาชิกสำเร็จ');
      } else {
        setError(`❌ ${response.data.message}`);
      }
    } catch (err) {
      setError(`❌ ${err.response?.data?.message || 'เกิดข้อผิดพลาด'}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-100 to-green-300 px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-green-700">สมัครสมาชิก</h2>
          <p className="mt-2 text-sm text-gray-600">กรอกข้อมูลเพื่อสร้างบัญชีใหม่</p>
        </div>

        {message && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-sm">
            {message}
          </div>
        )}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="firstname" className="block text-sm font-medium text-gray-700">ชื่อจริง</label>
            <input
              id="firstname"
              name="firstname"
              type="text"
              placeholder="ชื่อจริง"
              value={form.firstname}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="lastname" className="block text-sm font-medium text-gray-700">นามสกุล</label>
            <input
              id="lastname"
              name="lastname"
              type="text"
              placeholder="นามสกุล"
              value={form.lastname}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">อีเมล</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="your@email.com"
              value={form.email}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="passwords" className="block text-sm font-medium text-gray-700">รหัสผ่าน</label>
            <input
              id="passwords"
              name="passwords"
              type="password"
              placeholder="รหัสผ่าน"
              value={form.passwords}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 sm:text-sm"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition duration-200"
          >
            สมัครสมาชิก
          </button>
        </form>

        {/* ปุ่มลิงก์เพิ่มเติม */}
        <div className="text-center space-y-2 pt-2">
          <button
            onClick={() => navigate('/login')}
            className="text-sm text-green-700 hover:underline"
          >
            มีบัญชีอยู่แล้ว? เข้าสู่ระบบ
          </button>
          <br />
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-600 hover:underline"
          >
            ← กลับหน้าหลัก
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;
