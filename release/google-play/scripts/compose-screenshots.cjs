const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const [sourceDir, outputDir] = process.argv.slice(2);

if (!sourceDir || !outputDir) {
  console.error(
    "Usage: node compose-screenshots.cjs <source-screenshot-dir> <output-dir>",
  );
  process.exit(1);
}

const WIDTH = 1080;
const HEIGHT = 1920;
const SHOT_X = 56;
const SHOT_Y = 325;
const SHOT_WIDTH = 968;
const SHOT_HEIGHT = 1543;
const SOURCE_WIDTH = 1280;
const SOURCE_CROP_HEIGHT = 2040;

const screens = [
  {
    source: "01-dashboard.png",
    output: "01-dein-naechster-lernschritt.png",
    title: "Dein nächster Lernschritt",
    subtitle: "Alles Wichtige für heute auf einen Blick.",
    cropTop: 130,
    accent: "#08B9EF",
    accent2: "#155EEF",
  },
  {
    source: "02-plans.png",
    output: "02-lernplaene-die-sich-anpassen.png",
    title: "Lernpläne, die sich anpassen",
    subtitle: "Termine und Fortschritt bis zur Prüfung.",
    cropTop: 130,
    accent: "#00B7EB",
    accent2: "#37D8F5",
  },
  {
    source: "03-learning-path.png",
    output: "03-dein-weg-bis-zur-pruefung.png",
    title: "Ein klarer Weg bis zur Prüfung",
    subtitle: "Dayova plant den nächsten Schritt mit dir.",
    cropTop: 130,
    accent: "#00B7EB",
    accent2: "#8057E8",
  },
  {
    source: "04-active-session.png",
    output: "04-aktiv-lernen.png",
    title: "Aktiv lernen statt nur lesen",
    subtitle: "Kurze Aufgaben passend zu deinem Wissensstand.",
    cropTop: 200,
    accent: "#7C5CE4",
    accent2: "#16BAEF",
  },
  {
    source: "05-feedback.png",
    output: "05-direktes-feedback.png",
    title: "Sofort verstehen, was zählt",
    subtitle: "Direktes Feedback mit idealer Antwort.",
    cropTop: 400,
    accent: "#22C55E",
    accent2: "#11B8EF",
  },
  {
    source: "06-analysis.png",
    output: "06-staerken-und-luecken.png",
    title: "Stärken und Lücken erkennen",
    subtitle: "Prüfungsthemen nach Lernrisiko sortiert.",
    cropTop: 130,
    accent: "#0EA5E9",
    accent2: "#22C55E",
  },
  {
    source: "07-learning-times.png",
    output: "07-lernzeiten-die-passen.png",
    title: "Lernzeiten, die zu dir passen",
    subtitle: "Dayova plant nur, wenn du wirklich Zeit hast.",
    cropTop: 130,
    accent: "#14B8A6",
    accent2: "#12B9EE",
  },
  {
    source: "08-timetable.png",
    output: "08-stundenplan-verbunden.png",
    title: "Schule und Lernen verbunden",
    subtitle: "Dein Stundenplan fließt direkt in die Planung ein.",
    cropTop: 130,
    accent: "#2563EB",
    accent2: "#22D3EE",
  },
];

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function artworkSvg(screen, index) {
  return Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#FFFFFF"/>
          <stop offset="0.54" stop-color="#F6FBFF"/>
          <stop offset="1" stop-color="#EAF6FF"/>
        </linearGradient>
        <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${screen.accent}"/>
          <stop offset="1" stop-color="${screen.accent2}"/>
        </linearGradient>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#173B65" flood-opacity="0.15"/>
        </filter>
      </defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#background)"/>
      <circle cx="1030" cy="-50" r="340" fill="url(#accent)" opacity="0.10"/>
      <circle cx="995" cy="105" r="150" fill="url(#accent)" opacity="0.08"/>
      <rect x="48" y="317" width="984" height="1559" rx="44" fill="#FFFFFF" filter="url(#shadow)"/>
      <text x="124" y="72" fill="#5D6D83" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" letter-spacing="3">DAYOVA</text>
      <text x="1018" y="72" text-anchor="end" fill="#718197" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="600">${index + 1}/8</text>
      <text x="56" y="158" fill="#111827" font-family="Segoe UI, Arial, sans-serif" font-size="52" font-weight="750">${escapeXml(screen.title)}</text>
      <text x="56" y="221" fill="#64748B" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="450">${escapeXml(screen.subtitle)}</text>
    </svg>
  `);
}

function borderSvg() {
  return Buffer.from(`
    <svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${SHOT_X}" y="${SHOT_Y}" width="${SHOT_WIDTH}" height="${SHOT_HEIGHT}" rx="36" fill="none" stroke="#FFFFFF" stroke-width="4"/>
    </svg>
  `);
}

function maskSvg() {
  return Buffer.from(`
    <svg width="${SHOT_WIDTH}" height="${SHOT_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${SHOT_WIDTH}" height="${SHOT_HEIGHT}" rx="36" fill="#FFFFFF"/>
    </svg>
  `);
}

async function createScreenshotPanel(sourcePath, cropTop) {
  return sharp(sourcePath)
    .extract({
      left: 0,
      top: cropTop,
      width: SOURCE_WIDTH,
      height: SOURCE_CROP_HEIGHT,
    })
    .resize(SHOT_WIDTH, SHOT_HEIGHT, { fit: "fill" })
    .ensureAlpha()
    .composite([{ input: maskSvg(), blend: "dest-in" }])
    .png()
    .toBuffer();
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  const logo = await sharp(
    path.resolve(__dirname, "..", "assets", "play-store-icon-512.png"),
  )
    .resize(54, 54)
    .png()
    .toBuffer();

  for (const [index, screen] of screens.entries()) {
    const sourcePath = path.resolve(sourceDir, screen.source);
    const outputPath = path.resolve(outputDir, screen.output);
    const panel = await createScreenshotPanel(sourcePath, screen.cropTop);

    await sharp(artworkSvg(screen, index))
      .composite([
        { input: panel, left: SHOT_X, top: SHOT_Y },
        { input: logo, left: 56, top: 31 },
        { input: borderSvg(), left: 0, top: 0 },
      ])
      .flatten({ background: "#FFFFFF" })
      .removeAlpha()
      .png({ compressionLevel: 9, palette: false })
      .toFile(outputPath);

    const metadata = await sharp(outputPath).metadata();
    console.log(
      `${screen.output}: ${metadata.width}x${metadata.height}, ${metadata.channels} channels`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
