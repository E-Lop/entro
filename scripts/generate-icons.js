import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const iconsDir = join(__dirname, '..', 'public', 'icons');
const svgPath = join(iconsDir, 'icon.svg');

const sizes = [
  { size: 192, name: 'icon-192x192.png' },
  { size: 512, name: 'icon-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 16, name: 'favicon-16x16.png' },
];

async function generateIcons() {
  const svgBuffer = readFileSync(svgPath);

  for (const { size, name } of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(iconsDir, name));
    console.log(`Generated ${name}`);
  }

  // Generate maskable icon (with extra padding for safe area)
  const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="#16a34a"/>
    <circle cx="256" cy="256" r="140" fill="white"/>
    <line x1="256" y1="256" x2="256" y2="165" stroke="#16a34a" stroke-width="12" stroke-linecap="round"/>
    <line x1="256" y1="256" x2="320" y2="256" stroke="#16a34a" stroke-width="10" stroke-linecap="round"/>
    <circle cx="256" cy="256" r="12" fill="#16a34a"/>
    <path d="M330 145 Q360 115 360 145 Q360 175 330 175 Q300 175 330 145" fill="#22c55e"/>
  </svg>`;

  await sharp(Buffer.from(maskableSvg))
    .resize(512, 512)
    .png()
    .toFile(join(iconsDir, 'maskable-icon-512x512.png'));
  console.log('Generated maskable-icon-512x512.png');

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
