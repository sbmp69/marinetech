// Minimal static file server for the web/ folder
// Usage: node server.js

const http = require('http');
const fs = require('fs').promises;
const path = require('path');
// Import puppeteer with proper error handling
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (error) {
  console.error('Error loading Puppeteer:', error);
  process.exit(1);
}
const url = require('url');
const querystring = require('querystring');

const PORT = Number(process.env.PORT) || 5173;
const webRoot = path.join(__dirname, 'web');
const docxTemplatesRoot = path.join(__dirname, 'docx-templates'); // Updated path to docx-templates

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.svg': return 'image/svg+xml';
    case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default: return 'application/octet-stream';
  }
}

const server = http.createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Request-Method', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const parsedUrl = url.parse(req.url);
  const urlPath = decodeURI(parsedUrl.pathname);
  const query = querystring.parse(parsedUrl.query);
  
  // Handle PDF generation endpoint
  if (urlPath === '/generate-pdf' && req.method === 'POST') {
    console.log('Received PDF generation request');
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      let browser;
      try {
        console.log('Parsing request body...');
        const requestData = JSON.parse(body);
        const { html, filename = 'certificate.pdf' } = requestData;
        console.log('Request data:', { hasHtml: !!html, filename });
        
        if (!html) {
          throw new Error('No HTML content provided');
        }
        
        // Ensure filename always ends with .pdf and is properly sanitized
        const finalFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
        console.log(`Processing PDF generation for: ${finalFilename}`);
        
        console.log('Launching browser...');
        const launchOptions = {
          headless: 'new',
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
          ]
        };
        
        // Try to find Chrome/Chromium in common locations
        const chromePaths = [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
        ];
        
        for (const chromePath of chromePaths) {
          try {
            await fs.access(chromePath);
            launchOptions.executablePath = chromePath;
            console.log(`Using browser at: ${chromePath}`);
            break;
          } catch (e) {
            // Ignore and try next path
          }
        }
        
        console.log('Browser launch options:', launchOptions);
        browser = await puppeteer.launch(launchOptions);
        
        const page = await browser.newPage();
        console.log('Setting page content...');
        
        // Set the HTML content with a timeout
        await page.setContent(html, { 
          waitUntil: 'networkidle0',
          timeout: 30000 // 30 seconds timeout
        });
        
        console.log('Generating PDF...');
        const pdf = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
          timeout: 60000 // 60 seconds timeout
        });
        
        console.log('PDF generated successfully');
        
        // Send the PDF with proper headers using the final filename
        const cleanFilename = finalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
        
        console.log(`Sending PDF with filename: ${cleanFilename}`);
        
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${cleanFilename}"; filename*=UTF-8''${encodeURIComponent(cleanFilename)}`,
          'Content-Length': pdf.length,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Content-Type-Options': 'nosniff',
          'Content-Transfer-Encoding': 'binary'
        });
        res.end(pdf);
        
      } catch (error) {
        console.error('PDF generation error:', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ 
          error: 'Failed to generate PDF',
          details: error.message,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }));
      } finally {
        if (browser) {
          console.log('Closing browser...');
          await browser.close().catch(e => console.error('Error closing browser:', e));
        }
      }
    });
    
    req.on('error', (error) => {
      console.error('Request error:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        error: 'Request error',
        details: error.message
      }));
    });
    
    return;
  }
  
  // Handle static files
  let filePath;
  try {
    if (urlPath.startsWith('/templates/')) {
      // Serve from web templates directory (for HTML templates)
      const relativePath = urlPath.replace(/^\/templates\//, '');
      filePath = path.join(webRoot, 'templates', relativePath);
      console.log('Serving web template:', filePath);
    } else if (urlPath.startsWith('/docx-templates/')) {
      // Serve from docx templates directory
      const relativePath = urlPath.replace(/^\/docx-templates\//, '');
      filePath = path.join(docxTemplatesRoot, relativePath);
      console.log('Serving DOCX template:', filePath);
    } else {
      // Serve from web root
      filePath = path.join(webRoot, urlPath === '/' ? 'index.html' : urlPath);
    }

    // Prevent path traversal
    if (!filePath.startsWith(webRoot) && !filePath.startsWith(docxTemplatesRoot)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      // If file doesn't exist, serve 404
      if (err.code === 'ENOENT') {
        res.statusCode = 404;
        res.end('File not found');
        return;
      }
      throw err;
    }

    try {
      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }

      const data = await fs.readFile(filePath);
      res.setHeader('Content-Type', getContentType(filePath));
      res.end(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.statusCode = 404;
        res.end('Not found');
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error handling static file:', error);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Please stop the process using it or set PORT to a different value.`);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, () => {
  console.log(`Static server running at http://localhost:${PORT}`);
  console.log(`Serving from: ${webRoot}`);
});
