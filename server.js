const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const db = new sqlite3.Database('posts.db');

// Создаём таблицу, если её нет
db.run(`CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  content TEXT,
  image TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Настройка загрузки фото
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.use(express.static('.'));
app.use('/uploads', express.static('uploads'));
app.use(express.urlencoded({ extended: true }));

// Главная страница — список постов
app.get('/', (req, res) => {
  db.all('SELECT * FROM posts ORDER BY id DESC', (err, rows) => {
    let html = `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <title>Наш кружок</title>
      <style>
        body { font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        .post { background: white; padding: 20px; margin-bottom: 20px; border-radius: 10px; }
        img { max-width: 100%; border-radius: 8px; margin-top: 10px; }
        a { color: #0066cc; }
      </style>
    </head>
    <body>
      <h1>Наш молодёжный кружок</h1>
      <p><a href="/admin.html">+ Добавить новый пост</a></p>
    `;
    rows.forEach(post => {
      html += `
        <div class="post">
          <h2>${post.title}</h2>
          <p>${post.content.replace(/\n/g, '<br>')}</p>
          ${post.image ? `<img src="/uploads/${post.image}">` : ''}
          <small>${new Date(post.created_at).toLocaleString('ru')}</small>
        </div>
      `;
    });
    html += `</body></html>`;
    res.send(html);
  });
});

// Страница добавления поста
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Обработка формы
app.post('/add', upload.single('image'), (req, res) => {
  const { title, content } = req.body;
  const image = req.file ? req.file.filename : null;
  db.run('INSERT INTO posts (title, content, image) VALUES (?, ?, ?)', [title, content, image], () => {
    res.redirect('/');
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сайт запущен на порту ${PORT}`);
});