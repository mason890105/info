import sharp from "sharp";

const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#0f172a"/>
  <text x="50" y="72" font-size="60" text-anchor="middle">📈</text>
</svg>`);

await sharp(svg).resize(32, 32).toFile("public/favicon.ico");
await sharp(svg).resize(180, 180).png().toFile("public/apple-icon.png");
console.log("✅ favicon 生成完成！");