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
    <script src="https://cdn.jsdelivr.net/npm/tsparticles@2.12.0/tsparticles.bundle.min.js"></script>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #0a0a1a; font-family: Arial, sans-serif; overflow: hidden; }
      nav {
        position: absolute; top: 0; left: 0; right: 0;
        background: rgba(20, 20, 40, 0.9); padding: 12px 20px; z-index: 100;
      }
      nav a { color: #eee; text-decoration: none; margin-right: 18px; font-weight: bold; }
      nav a:hover { color: #f1c40f; }

      #room {
        width: 100vw; height: 100vh; position: relative;
        background: linear-gradient(180deg, #1a1a3e 0%, #2d1b4e 40%, #3d2a1a 100%);
      }

      #floor {
        position: absolute; bottom: 0; left: 0; right: 0; height: 80px;
        background: linear-gradient(#5d4037, #3e2723);
        z-index: 2;
      }

      #window {
        position: absolute; top: 60px; left: 40px; width: 140px; height: 180px;
        background: #87ceeb; border: 8px solid #5d4037; border-radius: 6px;
        z-index: 2;
      }

      #fireplace {
        position: absolute; bottom: 80px; left: 30px; width: 120px; height: 100px;
        background: #4a3728; border-radius: 6px 6px 0 0;
        z-index: 2;
      }
      #fire {
        position: absolute; bottom: 6px; left: 20px; width: 80px; height: 40px;
        background: radial-gradient(ellipse, #ff6b00, #ff3300 40%, transparent 70%);
        border-radius: 50%; animation: flicker 0.4s infinite alternate;
      }
      @keyframes flicker { from { opacity: 0.8; } to { opacity: 1; } }

      #tree-img {
        position: absolute;
        bottom: -40px;
        right: 20px;
        width: 900px;
        height: auto;
        z-index: 5;
        cursor: pointer;
      }

      .ornament {
        position: absolute;
        width: 42px;
        height: auto;
        z-index: 10;
        pointer-events: none;
        filter: drop-shadow(1px 2px 2px rgba(0,0,0,0.4));
        animation: appear 0.35s ease-out;
      }

      @keyframes appear {
        0% { transform: scale(0); opacity: 0; }
        70% { transform: scale(1.15); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }

      #palette {
        position: absolute; top: 70px; left: 20px;
        background: rgba(0,0,0,0.85); padding: 12px; border-radius: 12px;
        color: white; z-index: 50; max-width: 280px;
      }
      .toy-btn {
        width: 46px; height: 46px; object-fit: contain;
        margin: 4px; cursor: pointer; border: 2px solid transparent;
        border-radius: 8px; background: rgba(255,255,255,0.1);
      }
      .toy-btn.active { border-color: #f1c40f; }

      #tsparticles {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 8;
        pointer-events: none;
      }
        #snow {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 20;
  pointer-events: none;
}
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
      <div style="margin-bottom:8px; font-size:14px;">Выбери игрушку и кликни на ёлку</div>
      <img class="toy-btn active" src="https://i.ibb.co/9Hg5qPB1/1.png" data-src="https://i.ibb.co/9Hg5qPB1/1.png">
      <img class="toy-btn" src="https://i.ibb.co/JjMjR71z/2.png" data-src="https://i.ibb.co/JjMjR71z/2.png">
      <img class="toy-btn" src="https://i.ibb.co/ymgHjT2R/3.png" data-src="https://i.ibb.co/ymgHjT2R/3.png">
      <img class="toy-btn" src="https://i.ibb.co/wZ69Vjpg/4.png" data-src="https://i.ibb.co/wZ69Vjpg/4.png">
      <img class="toy-btn" src="https://i.ibb.co/GfcV8pSk/5.png" data-src="https://i.ibb.co/GfcV8pSk/5.png">
      <img class="toy-btn" src="https://i.ibb.co/NgTKcnjD/6.png" data-src="https://i.ibb.co/NgTKcnjD/6.png">
      <img class="toy-btn" src="https://i.ibb.co/G3Wxhr5n/7.png" data-src="https://i.ibb.co/G3Wxhr5n/7.png">
      <img class="toy-btn" src="https://i.ibb.co/mCgNSQHR/8.png" data-src="https://i.ibb.co/mCgNSQHR/8.png">
    </div>

    <div id="room">
      <div id="window"></div>
      <div id="fireplace"><div id="fire"></div></div>
      <div id="floor"></div>
      <img id="tree-img" src="https://i.ibb.co/bp7cWnn/4692475-01.png" alt="Ёлка">
      <div id="tsparticles"></div>
      <div id="snow"></div>
    </div>

    <script>
      let selectedToy = 'https://i.ibb.co/9Hg5qPB1/1.png';

      document.querySelectorAll('.toy-btn').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          selectedToy = btn.dataset.src;
          document.querySelectorAll('.toy-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        };
      });

      document.getElementById('tree-img').onclick = function(e) {
        const rect = this.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const centerX = rect.width / 2;
        const offset = (clickX - centerX) / centerX;
        const rotation = offset * -18;

        const x = e.clientX - 21;
        const y = e.clientY - 21;

        const ornament = document.createElement('img');
        ornament.className = 'ornament';
        ornament.src = selectedToy;
        ornament.style.left = x + 'px';
        ornament.style.top = y + 'px';
        ornament.style.transform = 'rotate(' + rotation + 'deg)';
        document.getElementById('room').appendChild(ornament);
      };

      // Дымчатый след
      tsParticles.load("tsparticles", {
  fullScreen: { enable: false },
  particles: {
    number: { value: 0 },
    color: { value: ["#ffffff", "#cce6ff", "#e6f2ff"] },
    opacity: {
      value: { min: 0.15, max: 0.4 },
      animation: {
        enable: true,
        speed: 1.2,
        minimumValue: 0,
        sync: false
      }
    },
    size: {
      value: { min: 6, max: 14 },
      animation: {
        enable: true,
        speed: 2,
        minimumValue: 1
      }
    },
    move: {
      enable: true,
      speed: 0.7,
      direction: "none",
      random: true,
      straight: false,
      outModes: { default: "destroy" }
    },
    life: {
      duration: { value: 1.4 },
      count: 1
    }
  },
  interactivity: {
    detectsOn: "window",
    events: {
      onHover: { enable: true, mode: "trail" }
    },
    modes: {
      trail: {
        delay: 0.06,
        quantity: 3,
        pauseOnStop: true
      }
    }
  }
});
// Снег
tsParticles.load("snow", {
  fullScreen: { enable: false },
  particles: {
    number: {
      value: 80,
      density: { enable: true, area: 800 }
    },
    color: { value: "#ffffff" },
    opacity: {
      value: { min: 0.3, max: 0.7 },
      animation: {
        enable: true,
        speed: 0.5,
        minimumValue: 0.1
      }
    },
    size: {
      value: { min: 1, max: 3.5 }
    },
    move: {
      enable: true,
      speed: { min: 0.5, max: 1.5 },
      direction: "bottom",
      straight: false,
      outModes: { default: "out" }
    },
    life: {
      duration: { value: 8 },
      count: 1
    }
  },
  interactivity: { detectsOn: "canvas", events: { resize: true } }
});
    </script>
  </body>
  </html>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сайт запущен на порту ${PORT}`);
});