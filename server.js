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
        position: absolute; bottom: 0; left: 0; right: 0; height: 90px;
        background: linear-gradient(#5d4037, #3e2723);
        z-index: 2;
      }

      /* Кресло — чуть меньше */
      #chair {
        position: absolute;
        bottom: 75px;
        left: 15px;
        width: 170px;
        height: auto;
        z-index: 4;
        pointer-events: none;
      }

      /* Камин — большой, примерно половина ёлки */
      #fireplace-img {
        position: absolute;
        bottom: 50px;
        left: 160px;
        width: 420px;
        height: auto;
        z-index: 4;
        cursor: pointer;
      }

      /* Огонь поверх камина */
      #fire {
        position: absolute;
        bottom: 110px;
        left: 290px;
        width: 140px;
        height: 90px;
        background: radial-gradient(ellipse at center, #fff8 0%, #ffaa00 25%, #ff5500 55%, transparent 75%);
        border-radius: 50%;
        z-index: 5;
        animation: fireFlicker 0.12s infinite alternate;
        pointer-events: none;
        filter: blur(1px);
      }
      @keyframes fireFlicker {
        0% { transform: scale(1) translateY(0); opacity: 0.8; }
        100% { transform: scale(1.1) translateY(-6px); opacity: 1; }
      }

      .ember {
        position: absolute;
        width: 3px;
        height: 3px;
        background: #ffbb66;
        border-radius: 50%;
        pointer-events: none;
        z-index: 6;
        opacity: 0.5;
        animation: emberFloat 2.8s infinite ease-out;
      }
      @keyframes emberFloat {
        0% { transform: translate(0, 0) scale(1); opacity: 0.6; }
        100% { transform: translate(var(--tx), var(--ty)) scale(0.2); opacity: 0; }
      }

      #tree-img {
        position: absolute;
        bottom: -40px;
        right: 10px;
        width: 880px;
        height: auto;
        z-index: 5;
        cursor: pointer;
      }

      .ornament, .gift, .stocking {
        position: absolute;
        z-index: 10;
        cursor: pointer;
        filter: drop-shadow(1px 2px 2px rgba(0,0,0,0.4));
        animation: appear 0.35s ease-out;
      }
      .ornament { width: 42px; }
      .gift { width: 75px; }
      .stocking { width: 60px; }

      @keyframes appear {
        0% { transform: scale(0); opacity: 0; }
        70% { transform: scale(1.15); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes disappear {
        to { transform: scale(0); opacity: 0; }
      }

      #palette {
        position: absolute; top: 70px; left: 20px;
        background: rgba(0,0,0,0.85); padding: 12px; border-radius: 12px;
        color: white; z-index: 50; max-width: 340px;
      }
      .mode-btn {
        margin: 3px; padding: 6px 12px; cursor: pointer;
        border: none; border-radius: 6px; background: #34495e; color: white;
      }
      .mode-btn.active { background: #f1c40f; color: #111; }
      .toy-btn {
        width: 40px; height: 40px; object-fit: contain; margin: 3px;
        cursor: pointer; border: 2px solid transparent; border-radius: 6px;
        background: rgba(255,255,255,0.08);
      }
      .toy-btn.active { border-color: #f1c40f; }

      #tsparticles, #snow {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        pointer-events: none;
      }
      #tsparticles { z-index: 8; }
      #snow { z-index: 12; }

      #music-btn {
        position: absolute; top: 70px; right: 20px; z-index: 100;
        background: #2c3e50; color: white; border: none;
        padding: 8px 14px; border-radius: 6px; cursor: pointer;
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

    <audio id="bg-music" loop>
      <source src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" type="audio/mpeg">
    </audio>
    <button id="music-btn">🎵 Музыка</button>

    <div id="palette">
      <div style="margin-bottom:6px;">Режим:</div>
      <button class="mode-btn active" data-mode="ornament">Игрушки</button>
      <button class="mode-btn" data-mode="gift">Подарки</button>
      <button class="mode-btn" data-mode="stocking">Носки</button>
      <div id="toy-list" style="margin-top:10px;">
        <img class="toy-btn active" src="https://i.ibb.co/9Hg5qPB1/1.png" data-src="https://i.ibb.co/9Hg5qPB1/1.png">
        <img class="toy-btn" src="https://i.ibb.co/JjMjR71z/2.png" data-src="https://i.ibb.co/JjMjR71z/2.png">
        <img class="toy-btn" src="https://i.ibb.co/ymgHjT2R/3.png" data-src="https://i.ibb.co/ymgHjT2R/3.png">
        <img class="toy-btn" src="https://i.ibb.co/wZ69Vjpg/4.png" data-src="https://i.ibb.co/wZ69Vjpg/4.png">
        <img class="toy-btn" src="https://i.ibb.co/GfcV8pSk/5.png" data-src="https://i.ibb.co/GfcV8pSk/5.png">
        <img class="toy-btn" src="https://i.ibb.co/NgTKcnjD/6.png" data-src="https://i.ibb.co/NgTKcnjD/6.png">
        <img class="toy-btn" src="https://i.ibb.co/G3Wxhr5n/7.png" data-src="https://i.ibb.co/G3Wxhr5n/7.png">
        <img class="toy-btn" src="https://i.ibb.co/mCgNSQHR/8.png" data-src="https://i.ibb.co/mCgNSQHR/8.png">
      </div>
    </div>

    <div id="room">
      <div id="floor"></div>
      <img id="chair" src="https://i.ibb.co/RpV1XtXd/2.png" alt="Кресло">
      <img id="fireplace-img" src="https://i.ibb.co/nMc11Frb/3.png" alt="Камин">
      <div id="fire"></div>
      <img id="tree-img" src="https://i.ibb.co/bp7cWnn/4692475-01.png" alt="Ёлка">
      <div id="tsparticles"></div>
      <div id="snow"></div>
    </div>

    <script>
      const gifts = [
        "https://i.ibb.co/XfGLxm22/4.png",
        "https://i.ibb.co/DfW5XB5N/6.png",
        "https://i.ibb.co/WW6Gp37d/8.png",
        "https://i.ibb.co/cXDrdxT7/7.png"
      ];
      const stockings = [
        "https://i.ibb.co/N6p7qR1z/9.png",
        "https://i.ibb.co/JjvY6TH7/10.png"
      ];

      let mode = "ornament";
      let selectedToy = "https://i.ibb.co/9Hg5qPB1/1.png";

      document.querySelectorAll(".mode-btn").forEach(btn => {
        btn.onclick = () => {
          mode = btn.dataset.mode;
          document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          document.getElementById("toy-list").style.display = (mode === "ornament") ? "block" : "none";
        };
      });

      document.querySelectorAll(".toy-btn").forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          selectedToy = btn.dataset.src;
          document.querySelectorAll(".toy-btn").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
        };
      });

      // Огоньки
      function spawnEmber() {
        const ember = document.createElement("div");
        ember.className = "ember";
        const angle = Math.random() * Math.PI * 2;
        const dist = 40 + Math.random() * 50;
        ember.style.setProperty("--tx", (Math.cos(angle) * dist) + "px");
        ember.style.setProperty("--ty", (Math.sin(angle) * dist - 30) + "px");
        ember.style.left = "360px";
        ember.style.bottom = "140px";
        document.getElementById("room").appendChild(ember);
        setTimeout(() => ember.remove(), 2800);
      }
      setInterval(spawnEmber, 160);

      // Ёлка — игрушки
      document.getElementById("tree-img").onclick = function(e) {
        if (mode !== "ornament") return;
        const rect = this.getBoundingClientRect();
        const offset = ((e.clientX - rect.left) - rect.width / 2) / (rect.width / 2);
        const rotation = offset * -18;

        const el = document.createElement("img");
        el.className = "ornament";
        el.src = selectedToy;
        el.style.left = (e.clientX - 21) + "px";
        el.style.top = (e.clientY - 21) + "px";
        el.style.transform = "rotate(" + rotation + "deg)";
        document.getElementById("room").appendChild(el);
      };

      // Подарки — клик по комнате
      document.getElementById("room").addEventListener("click", function(e) {
        if (mode !== "gift") return;
        if (e.target.closest("#palette") || e.target.closest("nav") || e.target.id === "tree-img" || e.target.id === "fireplace-img") return;

        const el = document.createElement("img");
        el.className = "gift";
        el.src = gifts[Math.floor(Math.random() * gifts.length)];
        el.style.left = (e.clientX - 37) + "px";
        el.style.top = (e.clientY - 37) + "px";
        document.getElementById("room").appendChild(el);
      });

      // Носки — клик по камину
      document.getElementById("fireplace-img").onclick = function(e) {
        if (mode !== "stocking") return;
        e.stopPropagation();
        const el = document.createElement("img");
        el.className = "stocking";
        el.src = stockings[Math.floor(Math.random() * stockings.length)];
        el.style.left = (e.clientX - 30) + "px";
        el.style.top = (e.clientY - 25) + "px";
        document.getElementById("room").appendChild(el);
      };

      // Удаление
      document.getElementById("room").addEventListener("click", function(e) {
        if (e.target.classList.contains("ornament") || e.target.classList.contains("gift") || e.target.classList.contains("stocking")) {
          e.stopPropagation();
          e.target.style.animation = "disappear 0.3s ease-in forwards";
          setTimeout(() => e.target.remove(), 280);
        }
      });

      // Музыка
      const music = document.getElementById("bg-music");
      const musicBtn = document.getElementById("music-btn");
      let playing = false;
      musicBtn.onclick = () => {
        if (playing) { music.pause(); musicBtn.textContent = "🎵 Музыка"; }
        else { music.play(); musicBtn.textContent = "⏸ Пауза"; }
        playing = !playing;
      };

      // След
      tsParticles.load("tsparticles", {
        fullScreen: { enable: false },
        particles: {
          number: { value: 0 },
          color: { value: ["#ffffff", "#d6ebff"] },
          opacity: { value: { min: 0.15, max: 0.45 }, animation: { enable: true, speed: 0.5, minimumValue: 0 } },
          size: { value: { min: 6, max: 15 } },
          move: { enable: true, speed: 0.4, random: true, outModes: "destroy" },
          life: { duration: { value: 2.4 }, count: 1 }
        },
        interactivity: {
          detectsOn: "window",
          events: { onHover: { enable: true, mode: "trail" } },
          modes: { trail: { delay: 0.05, quantity: 3 } }
        }
      });

      // Снег
      tsParticles.load("snow", {
        fullScreen: { enable: false },
        particles: {
          number: { value: 45 },
          color: { value: "#fff" },
          opacity: { value: { min: 0.15, max: 0.5 } },
          size: { value: { min: 1, max: 2.8 } },
          move: { enable: true, speed: { min: 0.3, max: 1 }, direction: "bottom", outModes: "out" }
        }
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