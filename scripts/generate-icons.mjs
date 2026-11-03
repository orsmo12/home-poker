// Generates all PNG app icons from public/logo.svg.  Usage: npm run icons
import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/logo.svg', import.meta.url));
const out = (f) => new URL(`../public/icons/${f}`, import.meta.url).pathname;
const BG = { r: 5, g: 6, b: 15, alpha: 1 };

await sharp(svg, { density: 384 }).resize(192, 192).png().toFile(out('icon-192.png'));
await sharp(svg, { density: 384 }).resize(512, 512).png().toFile(out('icon-512.png'));
await sharp(svg, { density: 384 }).resize(180, 180).flatten({ background: BG }).png().toFile(out('apple-touch-icon.png'));
// Maskable: logo at 80% inside a full-bleed background (Android crops to a circle/squircle).
const inner = await sharp(svg, { density: 384 }).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: BG } })
  .composite([{ input: inner, gravity: 'center' }]).png().toFile(out('maskable-512.png'));
console.log('Icons written to public/icons/');
