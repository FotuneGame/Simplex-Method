/**
 * ============================================================================
 * server.js — Локальный веб-сервер для проекта «simpleks»
 * Запуск: node server.js или npm start
 * 
 * Не требует внешних зависимостей (использует встроенный модуль http Node.js)
 * ============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  const filePath = path.join(PUBLIC_DIR, reqPath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'text/plain; charset=utf-8';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404: Файл не найден');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500: Внутренняя ошибка сервера');
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log('======================================================================');
  console.log('       СИМПЛЕКС-МЕТОД — ВЕБ-ИНТЕРФЕЙС УСПЕШНО ЗАПУЩЕН!                ');
  console.log('======================================================================');
  console.log(`  🌐 Откройте в браузере: \x1b[36m${url}\x1b[0m`);
  console.log('  💡 Для остановки нажмите Ctrl+C');
  console.log('======================================================================\n');

  // Автоматическое открытие в браузере по умолчанию на Windows
  if (process.platform === 'win32') {
    exec(`start ${url}`);
  }
});
