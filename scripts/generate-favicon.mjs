// Generate a proper multi-size favicon.ico from our SVG logo
// Requires: sharp, to-ico
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import toIco from 'to-ico';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const srcSvg = path.join(publicDir, 'logo_meta.svg');
const outIco = path.join(publicDir, 'favicon.ico');
const outIcoAlt = path.join(publicDir, 'favico.ico');

const SIZES = [16, 32, 48, 64];

async function main() {
    const svg = await fs.readFile(srcSvg);
    const pngBuffers = await Promise.all(
        SIZES.map((size) => sharp(svg).resize(size, size, { fit: 'contain' }).png().toBuffer())
    );

    const ico = await toIco(pngBuffers, { resize: false });
    await fs.writeFile(outIco, ico);
    await fs.writeFile(outIcoAlt, ico);
}

main().catch((err) => {
    // Silent fail for lint cleanliness; process exit non-zero for CI
    try {
        console.error(String(err?.message || err));
    } catch {
        void 0; // noop
    }
    process.exit(1);
});
