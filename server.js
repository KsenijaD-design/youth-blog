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
      <a href="/room" class="${active === 'room' ? 'active' : ''}">Ёлка</a>
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
// Новогодняя комната
app.get('/room', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="ru">
  <head>
    <meta charset="UTF-8">
    <title>Ёлка</title>
    <style>
      body { margin: 0; background: #1a1a2e; font-family: Arial; overflow: hidden; }
      #room {
        width: 100vw;
        height: 100vh;
        background: linear-gradient(#0f3460, #16213e);
        position: relative;
      }
      #tree {
        position: absolute;
        bottom: 50px;
        left: 50%;
        transform: translateX(-50%);
        width: 280px;
        height: 420px;
        background: #0d5c0d;
        clip-path: polygon(50% 0%, 8% 100%, 92% 100%);
        cursor: pointer;
      }
      .ornament {
        position: absolute;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.6);
      }
      #palette {
        position: absolute;
        top: 80px;
        left: 20px;
        background: rgba(0,0,0,0.7);
        padding: 15px;
        border-radius: 12px;
        color: white;
        z-index: 10;
      }
      .color-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        display: inline-block;
        margin: 4px;
        cursor: pointer;
        border: 2px solid white;
      }
      nav {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        background: #2c3e50;
        padding: 15px;
        z-index: 20;
      }
      nav a { color: white; text-decoration: none; margin-right: 20px; font-weight: bold; }
    </style>
  </head>
  <body>
    <nav>
      <a href="/">Главная</a>
      <a href="/room">Ёлка</a>
      <a href="/gallery">Галерея</a>
      <a href="/admin.html">+ Добавить пост</a>
    </nav>
    <div id="palette">
      <div style="margin-bottom:8px;">Выбери цвет и кликни на ёлку</div>
      <div class="color-btn" style="background:#e74c3c" data-color="#e74c3c"></div>
      <div class="color-btn" style="background:#f1c40f" data-color="#f1c40f"></div>
      <div class="color-btn" style="background:#3498db" data-color="#3498db"></div>
      <div class="color-btn" style="background:#9b59b6" data-color="#9b59b6"></div>
      <div class="color-btn" style="background:#ecf0f1" data-color="#ecf0f1"></div>
    </div>
    <div id="room">
      <div id="tree"></div>
    </div>

    <script>
      let selectedColor = '#e74c3c';

      document.querySelectorAll('.color-btn').forEach(btn => {
        btn.onclick = () => {
          selectedColor = btn.dataset.color;
          document.querySelectorAll('.color-btn').forEach(b => b.style.outline = 'none');
          btn.style.outline = '3px solid white';
        };
      });

      document.getElementById('tree').onclick = function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left - 14;
        const y = e.clientY - rect.top - 14;

        if (x < 10 || x > 250 || y < 10 || y > 390) return;

        const ornament = document.createElement('div');
        ornament.className = 'ornament';
        ornament.style.background = selectedColor;
        ornament.style.left = x + 'px';
        ornament.style.top = y + 'px';
        this.appendChild(ornament);
      };
    </script>
  </body>
  </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сайт запущен на порту ${PORT}`);
});