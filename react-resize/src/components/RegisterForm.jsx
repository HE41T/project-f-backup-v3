import { useState } from 'react';
import axios from 'axios';

const RegisterForm = () => {
  const [form, setForm] = useState({
    email: '',
    passwords: '',
    firstname: '',
    lastname: '',
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
    <div className="flex flex-col items-center justify-center min-h-screen bg-green-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-green-700">สมัครสมาชิก</h2>

        {message && <div className="mb-4 text-green-600">{message}</div>}
        {error && <div className="mb-4 text-red-600">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            name="firstname"
            placeholder="ชื่อจริง"
            value={form.firstname}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />
          <input
            type="text"
            name="lastname"
            placeholder="นามสกุล"
            value={form.lastname}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />
          <input
            type="email"
            name="email"
            placeholder="อีเมล"
            value={form.email}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />
          <input
            type="password"
            name="passwords"
            placeholder="รหัสผ่าน"
            value={form.passwords}
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required
          />
          <button
            type="submit"
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
          >
            สมัครสมาชิก
          </button>
        </form>
      </div>
    </div>
  );
};

export default RegisterForm;
