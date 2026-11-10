const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// Подключение к базе (вставь свою строку из Supabase)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Создаём таблицу при запуске
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      title TEXT,
      content TEXT,
      image TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}
initDB();

app.use(express.static('.'));
app.use(express.urlencoded({ extended: true }));

// Главная страница
app.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM posts ORDER BY id DESC');
  const rows = result.rows;

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
    ${post.image ? `<img src="${post.image}">` : ''}
    <small>${new Date(post.created_at).toLocaleString('ru')}</small>
    <form action="/delete/${post.id}" method="POST" style="margin-top: 10px;">
      <button type="submit" style="background:#e74c3c;color:white;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;">Удалить</button>
    </form>
  </div>
`;
  });

  html += `</body></html>`;
  res.send(html);
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});
// Удаление поста
app.post('/delete/:id', async (req, res) => {
  const id = req.params.id;
  await pool.query('DELETE FROM posts WHERE id = $1', [id]);
  res.redirect('/');
});

// Добавление поста (фото сохраняется прямо в базу)
app.post('/add', upload.single('image'), async (req, res) => {
  const { title, content } = req.body;
  let image = null;

  if (req.file) {
    const base64 = req.file.buffer.toString('base64');
    image = `data:${req.file.mimetype};base64,${base64}`;
  }

  await pool.query(
    'INSERT INTO posts (title, content, image) VALUES ($1, $2, $3)',
    [title, content, image]
  );

  res.redirect('/');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сайт запущен на порту ${PORT}`);
});