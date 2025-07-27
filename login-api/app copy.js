const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const mysql = require('mysql2');
const app = express()
const jsonParser = bodyParser.json()
const bcrypt = require('bcrypt');
const saltRounds = 10;
const jwt = require('jsonwebtoken');
const secret = 'SECRET-REAL-NO-FAKE'
const emailRegex = /^[a-zA-Z0-9._%+-]+@(gmail\.com|hotmail\.com|outlook\.com|yahoo\.com|rmutr\.ac\.th)$/;
const nameRegex = /^[A-Za-zก-๙0-9]+$/;
const MAX_NAME_LENGTH = 50;

app.use(cors())

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  database: 'mydb',
});

app.post('/register', jsonParser, function (req, res, next) {
  const { email, passwords, firstname, lastname } = req.body;

  // Validation
  if (!emailRegex.test(email)) {
    return res.status(400).json({ status: 'error', message: 'Invalid email format' });
  }

  if (!nameRegex.test(firstname) || firstname.length > MAX_NAME_LENGTH) {
    return res.status(400).json({ status: 'error', message: 'Invalid firstname (letters only, max 50)' });
  }

  if (!nameRegex.test(lastname) || lastname.length > MAX_NAME_LENGTH) {
    return res.status(400).json({ status: 'error', message: 'Invalid lastname (letters only, max 50)' });
  }

  bcrypt.hash(passwords, saltRounds, function (err, hash) {
    if (err) {
      return res.json({ status: 'error', message: err.message });
    }

    const createdAt = new Date();
    const defaultRole = 'user';

    connection.execute(
      'INSERT INTO users (email, passwords, firstname, lastname, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [email, hash, firstname, lastname, defaultRole, createdAt],
      function (err, results, fields) {
        if (err) {
          return res.json({ status: 'error', message: err.message });
        }
        res.json({ status: 'ok' });
      }
    );
  });
});

app.post('/login', jsonParser, function (req, res, next) {
  const { email, passwords } = req.body;

  if (!emailRegex.test(email)) {
    return res.status(400).json({ status: 'error', message: 'Invalid email format' });
  }

  connection.execute(
    'SELECT * FROM users WHERE email=?',
    [email],
    function (err, users, fields) {
      if (err) {
        return res.json({ status: 'error', message: err });
      }
      if (users.length === 0) {
        return res.json({ status: 'error', message: 'NO USER MA FAQ' });
      }

      bcrypt.compare(passwords, users[0].passwords, function (err, isLogin) {
        if (isLogin) {
          const user = users[0];
          const token = jwt.sign({ email: user.email }, secret, { expiresIn: '8h' });

          const now = new Date();
          connection.execute(
            'INSERT INTO user_logs (user_id, action, role, timestamp) VALUES (?, ?, ?, ?)',
            [user.id, 'login', user.role, now],
            function (logErr, logResult) {
              if (logErr) {
                console.error('Log error:', logErr);
              }
              res.json({ status: 'ok', message: 'Login LesGO', token });
            }
          );
        } else {
          res.json({ status: 'ITS FAKE', message: 'Login FAKE' });
        }
      });
    }
  );
});

app.post('/logout', jsonParser, function (req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    return res.status(401).json({ status: 'error', message: 'Token not provided' });
  }

  jwt.verify(token, secret, function (err, decoded) {
    if (err) {
      return res.status(403).json({ status: 'error', message: 'Invalid token' });
    }

    const email = decoded.email;

    // ดึงข้อมูลผู้ใช้จาก email
    connection.execute(
      'SELECT * FROM users WHERE email = ?',
      [email],
      function (err, users, fields) {
        if (err) {
          return res.json({ status: 'error', message: err.message });
        }

        if (users.length === 0) {
          return res.json({ status: 'error', message: 'User not found' });
        }

        const user = users[0];
        const now = new Date();

        // บันทึก log การ logout ลง user_logs
        connection.execute(
          'INSERT INTO user_logs (user_id, action, role, timestamp) VALUES (?, ?, ?, ?)',
          [user.id, 'logout', user.role, now],
          function (err, results, fields) {
            if (err) {
              return res.json({ status: 'error', message: err.message });
            }

            return res.json({ status: 'ok', message: 'Logout success + log saved' });
          }
        );
      }
    );
  });
});

app.post('/authen', jsonParser, function (req, res, next){
  try {
    const token = req.headers.authorization.split(' ')[1]
    var decoded = jwt.verify(token, secret);
    res.json({status: 'ok', message: decoded})
  }catch (err) {
    res.json({status: 'OK IT IS FAKE', message: err.message})
  }

})

app.get('/user-logs', jsonParser, function (req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ 
      status: 'error', 
      message: 'Unauthorized',
      redirect: '/login'
    });
  }

  jwt.verify(token, secret, function (err, decoded) {
    if (err) {
      return res.status(403).json({ 
        status: 'error', 
        message: 'Invalid token',
        redirect: '/login'
      });
    }

    connection.execute(
      'SELECT role FROM users WHERE email = ?',
      [decoded.email],
      function (err, users, fields) {
        if (err || users.length === 0) {
          return res.status(403).json({ 
            status: 'error', 
            message: 'Access denied',
            redirect: '/login'
          });
        }

        const userRole = users[0].role;
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

        // เงื่อนไขการค้นหาด้วยการกระทำ (action)
        if (action) {
          conditions.push('ul.action = ?');
          params.push(action);
        }

        // เงื่อนไขการค้นหาด้วยช่วงเวลา
        if (startDate) {
          conditions.push('ul.timestamp >= ?');
          params.push(new Date(startDate));
        }

        if (endDate) {
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
      }
    );
  });
});

// ฟังก์ชันตรวจสอบสิทธิ์
function authorize(roles = []) {
  return function(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    jwt.verify(token, secret, function(err, decoded) {
      if (err) {
        return res.status(403).json({ status: 'error', message: 'Invalid token' });
      }

      connection.execute(
        'SELECT * FROM users WHERE email = ?',
        [decoded.email],
        function(err, users) {
          if (err || users.length === 0) {
            return res.status(403).json({ status: 'error', message: 'User not found' });
          }

          const user = users[0];
          if (roles.length && !roles.includes(user.role)) {
            return res.status(403).json({ status: 'error', message: 'Insufficient permissions' });
          }

          req.user = user; // เก็บข้อมูลผู้ใช้ใน request
          next();
        }
      );
    });
  };
}

// เอ็นดพอยต์สำหรับดึงรายการผู้ใช้ทั้งหมด (เฉพาะ admin และ superuser)
app.get('/users', authorize(['admin', 'superuser']), function(req, res) {
  connection.execute(
    'SELECT id, email, firstname, lastname, role, created_at FROM users ORDER BY created_at DESC',
    function(err, users) {
      if (err) {
        return res.json({ status: 'error', message: err.message });
      }
      res.json({ status: 'ok', users });
    }
  );
});

// เอ็นดพอยต์สำหรับเปลี่ยน Role (เฉพาะ superuser)
app.put('/users/:id/role', authorize(['superuser']), jsonParser, function(req, res) {
  const { id } = req.params;
  const { role } = req.body;

  // ตรวจสอบ ID
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ status: 'error', message: 'Invalid user ID' });
  }

  // ตรวจสอบ Role
  const allowedRoles = ['admin', 'user'];
  if (!role || !allowedRoles.includes(role)) {
    return res.status(400).json({ status: 'error', message: 'Invalid role' });
  }

  connection.execute(
    'SELECT role FROM users WHERE id = ?',
    [id],
    function(err, users) {
      if (err || users.length === 0) {
        return res.json({ status: 'error', message: 'User not found' });
      }

      const userRole = users[0].role;
      if (userRole === 'superuser') {
        return res.json({ status: 'error', message: 'Cannot change superuser role' });
      }

      connection.execute(
        'UPDATE users SET role = ? WHERE id = ?',
        [role, id],
        function(err, result) {
          if (err) {
            return res.json({ status: 'error', message: err.message });
          }

          // บันทึกการเปลี่ยนแปลง Role
          const now = new Date();
          connection.execute(
            'INSERT INTO user_logs (user_id, action, role, timestamp) VALUES (?, ?, ?, ?)',
            [req.user.id, `change role of user ${id} to ${role}`, req.user.role, now],
            function(logErr) {
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
      const currentUserRole = req.user.role;

      // ตรวจสอบสิทธิ์การลบ
      if (targetRole === 'superuser') {
        return res.json({ status: 'error', message: 'Cannot delete superuser' });
      }

      if (targetRole === 'admin' && currentUserRole !== 'superuser') {
        return res.json({ status: 'error', message: 'Only superuser can delete admin' });
      }

      if (targetRole === 'user' && !['admin', 'superuser'].includes(currentUserRole)) {
        return res.json({ status: 'error', message: 'Insufficient permissions' });
      }

      connection.execute(
        'DELETE FROM users WHERE id = ?',
        [id],
        function(err, result) {
          if (err) {
            return res.json({ status: 'error', message: err.message });
          }

          // บันทึกการลบผู้ใช้
          const now = new Date();
          connection.execute(
            'INSERT INTO user_logs (user_id, action, role, timestamp) VALUES (?, ?, ?, ?)',
            [req.user.id, `delete user ${id} with role ${targetRole}`, currentUserRole, now],
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
  console.log('CORS-enabled web server listening on port 3333')
})