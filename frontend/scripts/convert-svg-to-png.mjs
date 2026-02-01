import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function convertSvgToPng(svgPath, pngPath, width, height) {
  const svgContent = fs.readFileSync(svgPath, 'utf8');
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; }
        body { 
          width: ${width}px; 
          height: ${height}px; 
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
        }
        svg { width: 100%; height: 100%; }
      </style>
    </head>
    <body>${svgContent}</body>
    </html>
  `;

  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 }); // 2x for retina
  await page.setContent(html);
  
  // Wait for emoji to render
  await page.waitForTimeout(500);
  
  await page.screenshot({ 
    path: pngPath, 
    omitBackground: true,
    type: 'png'
  });
  
  await browser.close();
  console.log(`Created: ${pngPath}`);
}

async function main() {
  const publicDir = path.join(__dirname, '../public/brand');
  
  // Logo: 400x400
  await convertSvgToPng(
    path.join(publicDir, 'logo.svg'),
    path.join(publicDir, 'logo.png'),
    400,
    400
  );
  
  // Banner: 1500x500
  await convertSvgToPng(
    path.join(publicDir, 'banner.svg'),
    path.join(publicDir, 'banner.png'),
    1500,
    500
  );
  
  console.log('Done!');
}

main().catch(console.error);
