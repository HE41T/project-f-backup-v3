// session_auth_app.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const session = require('express-session');

const app = express();
const jsonParser = bodyParser.json();
const saltRounds = 10;
const emailRegex = /^[a-zA-Z0-9._%+-]+@(gmail\.com|hotmail\.com|outlook\.com|yahoo\.com|rmutr\.ac\.th)$/;
const nameRegex = /^[A-Za-zก-๙0-9]+$/;
const MAX_NAME_LENGTH = 50;

app.use(cors({
  origin: 'http://localhost:3001', // แก้ให้ตรง frontend
  credentials: true
}));

app.use(session({
  secret: 'SECRET-REAL-NO-FAKE',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 ชม.
}));

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  database: 'test1'
});


app.post('/register', jsonParser, (req, res) => {
  const { email, passwords, firstname, lastname } = req.body;

  if (!emailRegex.test(email)) {
    return res.status(400).json({ status: 'error', message: 'Invalid email format' });
  }

  if (!nameRegex.test(firstname) || firstname.length > MAX_NAME_LENGTH) {
    return res.status(400).json({ status: 'error', message: 'Invalid firstname' });
  }

  if (!nameRegex.test(lastname) || lastname.length > MAX_NAME_LENGTH) {
    return res.status(400).json({ status: 'error', message: 'Invalid lastname' });
  }

  bcrypt.hash(passwords, saltRounds, (err, hash) => {
    if (err) return res.json({ status: 'error', message: err.message });

    const createdAt = new Date();
    const defaultRole = 'user';

    connection.execute(
      'INSERT INTO users (email, passwords, firstname, lastname, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [email, hash, firstname, lastname, defaultRole, createdAt],
      (err) => {
        if (err) return res.json({ status: 'error', message: err.message });
        res.json({ status: 'ok' });
      }
    );
  });
});

app.post('/login', jsonParser, (req, res) => {
  const { email, passwords } = req.body;

  connection.execute(
    'SELECT * FROM users WHERE email = ?',
    [email],
    (err, users) => {
      if (err) {
        console.error('DB error:', err);
        return res.status(500).json({ status: 'error', message: 'Database error' });
      }

      if (users.length === 0) {
        return res.status(400).json({ status: 'error', message: 'User not found' });
      }

      const user = users[0];
      // แก้ตรงนี้ให้ตรงกับชื่อคอลัมน์รหัสผ่านจริง ๆ
      const hashedPassword = user.passwords || user.password; 

      if (!hashedPassword) {
        return res.status(500).json({ status: 'error', message: 'Password hash missing in DB' });
      }

      bcrypt.compare(passwords, hashedPassword, (err, isLogin) => {
        if (err) {
          console.error('bcrypt.compare error:', err);
          return res.status(500).json({ status: 'error', message: 'Error comparing passwords' });
        }

        if (!isLogin) {
          return res.status(401).json({ status: 'error', message: 'Incorrect password' });
        }

        // เช็ค session active
        connection.execute(
          'SELECT * FROM active_sessions WHERE user_id = ?',
          [user.id],
          (err, sessions) => {
            if (err) {
              console.error('Session check error:', err);
              return res.status(500).json({ status: 'error', message: 'Session check error' });
            }

            if (sessions.length > 0) {
              return res.status(403).json({ status: 'error', message: 'User already logged in' });
            }

            req.session.user = {
              id: user.id,
              email: user.email,
              role: user.role,
              firstname: user.firstname,   // เพิ่ม
              lastname: user.lastname      // เพิ่ม
            };

            connection.execute(
              'INSERT INTO active_sessions (user_id, session_id) VALUES (?, ?)',
              [user.id, req.sessionID],
              (err) => {
                if (err) {
                  console.error('Insert session error:', err);
                  return res.status(500).json({ status: 'error', message: 'Insert session error' });
                }

                connection.execute(
                  'INSERT INTO user_logs (user_id, action, role, timestamp) VALUES (?, ?, ?, ?)',
                  [user.id, 'login', user.role, new Date()],
                  (err) => {
                    if (err) {
                      console.error('Insert log error:', err);
                      return res.status(500).json({ status: 'error', message: 'Insert log error' });
                    }

                    res.json({ status: 'ok', message: 'Login successful', role: user.role });
                  }
                );
              }
            );
          }
        );
      });
    }
  );
});

app.post('/logout', function (req, res) {
  if (!req.session.user) {
    return res.status(401).json({ status: 'error', message: 'Not logged in' });
  }

  const { id, role } = req.session.user;

  connection.execute(
    'DELETE FROM active_sessions WHERE user_id = ?',
    [id],
    function () {
      connection.execute(
        'INSERT INTO user_logs (user_id, action, role, timestamp) VALUES (?, ?, ?, ?)',
        [id, 'logout', role, new Date()]
      );

      req.session.destroy(() => {
        res.json({ status: 'ok', message: 'Logout successful' });
      });
    }
  );
});

app.post('/reset-password', jsonParser, (req, res) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ status: 'unauthorized', message: 'Please login' });
  }

  const { currentPassword, newPassword } = req.body;
  const userId = req.session.user.id;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ status: 'error', message: 'Missing required fields' });
  }

  // 1. ดึงรหัสผ่านเดิมจากฐานข้อมูล
  connection.execute(
    'SELECT passwords FROM users WHERE id = ?',
    [userId],
    (err, results) => {
      if (err) {
        return res.status(500).json({ status: 'error', message: 'Database error' });
      }
      if (results.length === 0) {
        return res.status(404).json({ status: 'error', message: 'User not found' });
      }

      const hashedPassword = results[0].passwords;

      // 2. ตรวจสอบรหัสผ่านเดิม
      bcrypt.compare(currentPassword, hashedPassword, (err, match) => {
        if (err) {
          return res.status(500).json({ status: 'error', message: 'Password comparison error' });
        }

        if (!match) {
          return res.status(400).json({ status: 'error', message: 'Current password is incorrect' });
        }

        // 3. เข้ารหัสรหัสผ่านใหม่
        bcrypt.hash(newPassword, saltRounds, (err, newHashedPassword) => {
          if (err) {
            return res.status(500).json({ status: 'error', message: 'Hashing failed' });
          }

          // 4. อัปเดตรหัสผ่านใหม่ในฐานข้อมูล
          connection.execute(
            'UPDATE users SET passwords = ? WHERE id = ?',
            [newHashedPassword, userId],
            (err2) => {
              if (err2) {
                return res.status(500).json({ status: 'error', message: 'Failed to update password' });
              }

              return res.status(200).json({ status: 'ok', message: 'Password updated successfully' });
            }
          );
        });
      });
    }
  );
});

app.get('/auth/check', (req, res) => {
  if (req.session && req.session.user) {
    return res.status(200).json({ status: 'ok', user: req.session.user });
  } else {
    return res.status(401).json({ status: 'unauthorized' });
  }
});


function sessionAuth(roles = []) {
  return function(req, res, next) {
    if (!req.session.user) {
      return res.status(401).json({ status: 'error', message: 'Not logged in' });
    }

    if (roles.length && !roles.includes(req.session.user.role)) {
      return res.status(403).json({ status: 'error', message: 'Access denied' });
    }

    next();
  };
}

function authorize(allowedRoles = []) {
  return function (req, res, next) {
    const user = req.session.user;

    if (!user) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized', redirect: '/login' });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ status: 'error', message: 'Forbidden: insufficient permission' });
    }

    next();
  };
}


app.get('/user-logs', jsonParser, function (req, res, next) {
  const sessionUser = req.session.user;

  if (!sessionUser) {
    return res.status(401).json({ 
      status: 'error', 
      message: 'Unauthorized', 
      redirect: '/login' 
    });
  }

  const userRole = sessionUser.role;
  if (userRole !== 'admin' && userRole !== 'superuser') {
    return res.status(403).json({ 
      status: 'error', 
      message: 'Admin or Superuser access required', 
      redirect: '/login' 
    });
  }

  // รับพารามิเตอร์การค้นหาจาก query string
  const { id, name, email, action, startDate, endDate } = req.query;

  let conditions = [];
  let params = [];

  // เงื่อนไขการค้นหาด้วย User ID
  if (id && !isNaN(id)) {
    conditions.push('ul.user_id = ?');
    params.push(parseInt(id));
  }

  // เงื่อนไขการค้นหาด้วยชื่อ
  if (name) {
    conditions.push('(u.firstname LIKE ? OR u.lastname LIKE ?)');
    params.push(`%${name}%`, `%${name}%`);
  }

  // เงื่อนไขการค้นหาด้วยอีเมล
  if (email) {
    conditions.push('u.email LIKE ?');
    params.push(`%${email}%`);
  }

  // เงื่อนไขการค้นหาด้วย action
  if (action) {
    conditions.push('ul.action = ?');
    params.push(action);
  }

  // เงื่อนไขการค้นหาด้วยช่วงเวลา
  if (startDate && !isNaN(Date.parse(startDate))) {
    conditions.push('ul.timestamp >= ?');
    params.push(new Date(startDate));
  }

  if (endDate && !isNaN(Date.parse(endDate))) {
    conditions.push('ul.timestamp <= ?');
    params.push(new Date(endDate));
  }

  // สร้าง query สุดท้าย
  let query = `
    SELECT ul.*, u.firstname, u.lastname, u.email, u.role 
    FROM user_logs ul
    JOIN users u ON ul.user_id = u.id
  `;

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY ul.timestamp DESC LIMIT 100';

  connection.execute(query, params, function (err, logs, fields) {
    if (err) {
      console.error('Database error:', err);
      return res.json({ status: 'error', message: err.message });
    }
    res.json({ status: 'ok', logs });
  });
});

// เอ็นดพอยต์สำหรับดึงรายการผู้ใช้ทั้งหมด (เฉพาะ admin และ superuser)
app.get('/users', sessionAuth(['admin', 'superuser']), function(req, res) {
  connection.execute(
    'SELECT id, email, firstname, lastname, role, created_at FROM users ORDER BY created_at DESC',
    function(err, users) {
      if (err) return res.json({ status: 'error', message: err.message });
      res.json({ status: 'ok', users });
    }
  );
});

// เอ็นดพอยต์สำหรับเปลี่ยน Role (เฉพาะ superuser)
app.put('/users/:id/role', authorize(['superuser']), jsonParser, function (req, res) {
  const { id } = req.params;
  const { role } = req.body;

  // ตรวจสอบ ID
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ status: 'error', message: 'Invalid user ID' });
  }

  // ตรวจสอบ Role ที่กำหนดใหม่
  const allowedRoles = ['admin', 'user'];
  if (!role || !allowedRoles.includes(role)) {
    return res.status(400).json({ status: 'error', message: 'Invalid role' });
  }

  // เช็กว่า session login อยู่หรือไม่
  const sessionUser = req.session.user;
  if (!sessionUser) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized', redirect: '/login' });
  }

  // ไม่ให้เปลี่ยน role ของ superuser
  connection.execute(
    'SELECT role FROM users WHERE id = ?',
    [id],
    function (err, users) {
      if (err || users.length === 0) {
        return res.json({ status: 'error', message: 'User not found' });
      }

      const currentRole = users[0].role;
      if (currentRole === 'superuser') {
        return res.json({ status: 'error', message: 'Cannot change superuser role' });
      }

      // ทำการอัปเดต role
      connection.execute(
        'UPDATE users SET role = ? WHERE id = ?',
        [role, id],
        function (err, result) {
          if (err) {
            return res.json({ status: 'error', message: err.message });
          }

          // บันทึกการเปลี่ยนแปลงลง log
          const now = new Date();
          connection.execute(
            'INSERT INTO user_logs (user_id, action, role, timestamp) VALUES (?, ?, ?, ?)',
            [sessionUser.id, `change role of user ${id} to ${role}`, sessionUser.role, now],
            function (logErr) {
              if (logErr) console.error('Log error:', logErr);
            }
          );

          res.json({ status: 'ok', message: 'Role updated successfully' });
        }
      );
    }
  );
});


// เอ็นดพอยต์สำหรับลบผู้ใช้
app.delete('/users/:id', authorize(['admin', 'superuser']), jsonParser, function(req, res) {
  const { id } = req.params;
  const { confirm } = req.body;

  if (!confirm) {
    return res.json({ status: 'error', message: 'Confirmation required' });
  }

  connection.execute(
    'SELECT role FROM users WHERE id = ?',
    [id],
    function(err, users) {
      if (err || users.length === 0) {
        return res.json({ status: 'error', message: 'User not found' });
      }

      const targetRole = users[0].role;
      const currentUserRole = req.session.user.role; // ✅ ใช้ session-based
      const currentUserId = req.session.user.id;

      // 🔒 ป้องกันลบ superuser
      if (targetRole === 'superuser') {
        return res.json({ status: 'error', message: 'Cannot delete superuser' });
      }

      // 🔐 admin ห้ามลบ admin ด้วยกันเอง
      if (targetRole === 'admin' && currentUserRole !== 'superuser') {
        return res.json({ status: 'error', message: 'Only superuser can delete admin' });
      }

      connection.execute(
        'DELETE FROM users WHERE id = ?',
        [id],
        function(err, result) {
          if (err) {
            return res.json({ status: 'error', message: err.message });
          }

          // 📝 บันทึก log การลบ
          const now = new Date();
          const action = `delete user ${id} with role ${targetRole}`;

          connection.execute(
            'INSERT INTO user_logs (user_id, action, role, timestamp) VALUES (?, ?, ?, ?)',
            [currentUserId, action, currentUserRole, now],
            function(logErr) {
              if (logErr) console.error('Log error:', logErr);
            }
          );

          res.json({ status: 'ok', message: 'User deleted successfully' });
        }
      );
    }
  );
});


app.listen(3333, function () {
  console.log('Session-based server running on port 3333');
});
