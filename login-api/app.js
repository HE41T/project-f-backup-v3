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

app.use(cors())

const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  database: 'mydb',
});


app.post('/register', jsonParser, function (req, res, next) {
  const { email, passwords, firstname, lastname } = req.body;

  bcrypt.hash(passwords, saltRounds, function(err, hash) {
    if (err) {
      return res.json({ status: 'error', message: err.message });
    }

    const createdAt = new Date();
    const defaultRole = 'user'; // กำหนด role อัตโนมัติ

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
  connection.execute(
    'SELECT * FROM users WHERE email=?',
    [req.body.email],
    function (err, users, fields) {
      if (err) {
        res.json({ status: 'error', message: err });
        return;
      }
      if (users.length == 0) {
        res.json({ status: 'error', message: 'NO USER MA FAQ' });
        return;
      }

      bcrypt.compare(req.body.passwords, users[0].passwords, function(err, isLogin) {
        if (isLogin) {
          const user = users[0];
          const token = jwt.sign({ email: user.email }, secret, { expiresIn: '8h' });

          // ✅ เพิ่ม log การเข้าใช้งาน
          const now = new Date();
          connection.execute(
            'INSERT INTO user_logs (user_id, action, role, timestamp) VALUES (?, ?, ?, ?)',
            [user.id, 'login', user.role, now],
            function (logErr, logResult) {
              if (logErr) {
                console.error('Log error:', logErr); // ไม่ส่งให้ user เห็น แต่ log เก็บไว้
              }
              // ตอบกลับหลังจากบันทึก log
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

app.listen(3333, function () {
  console.log('CORS-enabled web server listening on port 3333')
})
