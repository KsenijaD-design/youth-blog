const express = require('express');
const multer = require('multer');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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

// Общие стили и навигация
function getHeader(active = '') {
  return `
  <!DOCTYPE html>
  <html lang="ru">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Наш кружок</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; margin: 0; background: #f8f9fa; color: #333; }
      nav { background: #2c3e50; padding: 15px 0; }
      nav a { color: white; text-decoration: none; margin: 0 20px; font-weight: bold; }
      nav a:hover, nav a.active { color: #3498db; }
      .container { max-width: 1100px; margin: 0 auto; padding: 20px; }
      .hero { text-align: center; padding: 40px 20px; background: white; border-radius: 12px; margin-bottom: 30px; }
      .hero img { width: 100%; max-height: 400px; object-fit: cover; border-radius: 12px; margin: 20px 0; }
      .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
      .card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: transform 0.2s; }
      .card:hover { transform: translateY(-5px); }
      .card img { width: 100%; height: 180px; object-fit: cover; }
      .card-body { padding: 15px; }
      .post { background: white; padding: 20px; margin-bottom: 20px; border-radius: 12px; }
      .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 15px; }
      .gallery img { width: 100%; height: 200px; object-fit: cover; border-radius: 10px; }
      button { background: #e74c3c; color: white; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; }
      a.btn { display: inline-block; background: #3498db; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; }
    </style>
  </head>
  <body>
    <nav>
      <a href="/" class="${active === 'home' ? 'active' : ''}">Главная</a>
      <a href="/blog" class="${active === 'blog' ? 'active' : ''}">Блог</a>
      <a href="/gallery" class="${active === 'gallery' ? 'active' : ''}">Галерея</a>
      <a href="/admin.html">+ Добавить пост</a>
    </nav>
    <div class="container">
  `;
}

function getFooter() {
  return `</div></body></html>`;
}

// Главная страница
app.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM posts ORDER BY id DESC LIMIT 3');
  const posts = result.rows;

  let html = getHeader('home');
  html += `
    <div class="hero">
      <h1>Наш молодёжный кружок</h1>
      <img src="https://picsum.photos/1200/500" alt="Главное фото">
      <p>Добро пожаловать на сайт нашего кружка! Здесь мы делимся новостями, фотографиями и историями.</p>
      <a href="/blog" class="btn">Все посты</a>
    </div>
    <h2>Последние посты</h2>
    <div class="cards">
  `;

  posts.forEach(post => {
    html += `
      <div class="card">
        ${post.image ? `<img src="${post.image}">` : '<img src="https://picsum.photos/400/200">'}
        <div class="card-body">
          <h3>${post.title}</h3>
          <a href="/blog">Читать</a>
        </div>
      </div>
    `;
  });

  html += `</div>` + getFooter();
  res.send(html);
});

// Страница блога (карточки)
app.get('/blog', async (req, res) => {
  const result = await pool.query('SELECT * FROM posts ORDER BY id DESC');
  const posts = result.rows;

  let html = getHeader('blog');
  html += `<h1>Блог</h1><div class="cards">`;

  posts.forEach(post => {
    html += `
      <div class="card">
        ${post.image ? `<img src="${post.image}">` : '<img src="https://picsum.photos/400/200">'}
        <div class="card-body">
          <h3>${post.title}</h3>
          <p>${post.content.substring(0, 100)}...</p>
          <form action="/delete/${post.id}" method="POST">
            <button type="submit">Удалить</button>
          </form>
        </div>
      </div>
    `;
  });

  html += `</div>` + getFooter();
  res.send(html);
});

// Галерея
app.get('/gallery', async (req, res) => {
  const result = await pool.query('SELECT image, title FROM posts WHERE image IS NOT NULL ORDER BY id DESC');
  const images = result.rows;

  let html = getHeader('gallery');
  html += `<h1>Галерея</h1><div class="gallery">`;

  images.forEach(img => {
    html += `<img src="${img.image}" alt="${img.title}">`;
  });

  html += `</div>` + getFooter();
  res.send(html);
});

// Админка
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Добавление поста
app.post('/add', upload.single('image'), async (req, res) => {
  const { title, content } = req.body;
  let image = null;
  if (req.file) {
    const base64 = req.file.buffer.toString('base64');
    image = `data:${req.file.mimetype};base64,${base64}`;
  }
  await pool.query('INSERT INTO posts (title, content, image) VALUES ($1, $2, $3)', [title, content, image]);
  res.redirect('/blog');
});

// Удаление
app.post('/delete/:id', async (req, res) => {
  await pool.query('DELETE FROM posts WHERE id = $1', [req.params.id]);
  res.redirect('/blog');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сайт запущен на порту ${PORT}`);
});