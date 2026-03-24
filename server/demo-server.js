/**
 * Simple HTTP Server for Axial2.5D Demo
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);

  // Parse URL
  let urlPath = req.url === '/' ? '/standalone.html' : req.url;
  
  // Remove query string
  urlPath = urlPath.split('?')[0];

  // Build file path
  const filePath = path.join(__dirname, '..', 'public', urlPath);

  // Get file extension
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  // Read and serve file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 - File Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 - Internal Server Error');
      }
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║           Axial2.5D Demo Server Started                ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log(`║  🌐 Local:   http://localhost:${PORT}                     ║`);
  console.log(`║  🌍 Network: http://0.0.0.0:${PORT}                       ║`);
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log('║  Controls:                                             ║');
  console.log('║    WASD/Arrows - Move player                           ║');
  console.log('║    Mouse Click - Move to tile                          ║');
  console.log('║    Mouse Drag  - Pan camera                            ║');
  console.log('║    Mouse Wheel - Zoom                                  ║');
  console.log('║    G - Toggle grid                                     ║');
  console.log('║    B - Toggle wireframe                                ║');
  console.log('║    Space - Toggle debug                                ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log('║  Press Ctrl+C to stop                                  ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.close(() => {
    console.log('Server stopped.');
    process.exit(0);
  });
});
