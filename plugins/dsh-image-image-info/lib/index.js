/**
 * 图片工具：image info — 图片信息工具
 */

export const name = "dsh-image-image-info";
export const inject = ["tools"];

const NL = String.fromCharCode(10);
const SITE = "https://deepseekbase.com/zh/tools/";
const TEXT_OUTPUT = {
  schema: { type: "object", additionalProperties: false, properties: { text: { type: "string" } }, required: ["text"] },
  render: (_args, value) => [{ type: "text", text: (value && value.text) || "" }],
};

function bytesOf(t) {
  let s = String(t).trim();
  const m = s.match(/^data:([^;]+);base64,(.*)$/s);
  if (m) s = m[2];
  s = s.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function u16be(b, o) { return (b[o] << 8) | b[o + 1]; }
function u16le(b, o) { return b[o] | (b[o + 1] << 8); }
function u32be(b, o) { return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; }
function u32le(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
function mimeOf(b) {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (b[0] === 0x42 && b[1] === 0x4d) return "image/bmp";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  if (b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00) return "image/x-icon";
  return "未知";
}
function dimsOf(b) {
  const mime = mimeOf(b);
  if (mime === "image/png") return [u32be(b, 16), u32be(b, 20), "PNG"];
  if (mime === "image/gif") return [u16le(b, 6), u16le(b, 8), "GIF"];
  if (mime === "image/bmp") return [Math.abs(u32le(b, 18)), Math.abs(u32le(b, 22)), "BMP"];
  if (mime === "image/jpeg") {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return [u16be(b, i + 7), u16be(b, i + 5), "JPEG"];
      const len = u16be(b, i + 2);
      i += 2 + len;
    }
    return [0, 0, "JPEG"];
  }
  if (mime === "image/webp") {
    const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (chunk === "VP8X") return [1 + (b[24] | (b[25] << 8) | (b[26] << 16)), 1 + (b[27] | (b[28] << 8) | (b[29] << 16)), "WebP"];
    if (chunk === "VP8L") { const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24); return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1, "WebP"]; }
    return [u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff, "WebP"];
  }
  return [0, 0, mime];
}

const OPS = {
  image_info: (t) => { const b = bytesOf(t); const [w, h, kind] = dimsOf(b); return "格式: " + kind + NL + "尺寸: " + w + " × " + h + NL + "字节: " + b.length + "（" + (Math.round(b.length / 1024 * 10) / 10) + " KB）" + NL + "MIME: " + mimeOf(b); },
  png_info: (t) => { const b = bytesOf(t); if (mimeOf(b) !== "image/png") return "不是 PNG"; return "PNG " + u32be(b, 16) + " × " + u32be(b, 20) + NL + "位深: " + b[24] + NL + "颜色类型: " + b[25]; },
  jpeg_info: (t) => { const b = bytesOf(t); if (mimeOf(b) !== "image/jpeg") return "不是 JPEG"; const [w, h] = dimsOf(b); return "JPEG " + w + " × " + h; },
  gif_info: (t) => { const b = bytesOf(t); if (mimeOf(b) !== "image/gif") return "不是 GIF"; return "GIF " + u16le(b, 6) + " × " + u16le(b, 8); },
  bmp_info: (t) => { const b = bytesOf(t); if (mimeOf(b) !== "image/bmp") return "不是 BMP"; const [w, h] = dimsOf(b); return "BMP " + w + " × " + h; },
  webp_info: (t) => { const b = bytesOf(t); if (mimeOf(b) !== "image/webp") return "不是 WebP"; const [w, h] = dimsOf(b); return "WebP " + w + " × " + h; },
  image_aspect: (t) => { const [w, h] = dimsOf(bytesOf(t)); if (!w || !h) return "无法读取尺寸"; const g = (a, b) => (b ? g(b, a % b) : a); const d = g(w, h); return "宽高比: " + (w / d) + ":" + (h / d) + "（" + w + " × " + h + "）"; },
  image_megapixels: (t) => { const [w, h] = dimsOf(bytesOf(t)); return "像素: " + (Math.round(w * h / 10000) / 100) + " 万（" + (Math.round(w * h / 1e6 * 100) / 100) + " MP）"; },
  datauri_parse: (t) => { const m = String(t).trim().match(/^data:([^;]+)(;base64)?,(.*)$/s); if (!m) return "不是 Data URI"; return "MIME: " + m[1] + NL + "编码: " + (m[2] ? "base64" : "文本") + NL + "数据长度: " + m[3].length; },
  datauri_bytes: (t) => { const b = bytesOf(t); return "解码字节: " + b.length + "（" + (Math.round(b.length / 1024 * 10) / 10) + " KB）"; },
  svg_size: (t) => { const s = String(t); const w = (s.match(/<svg[^>]*\bwidth=["']([^"']+)["']/i) || [])[1] || "未标注"; const h = (s.match(/<svg[^>]*\bheight=["']([^"']+)["']/i) || [])[1] || "未标注"; const vb = (s.match(/viewBox=["']([^"']+)["']/i) || [])[1] || "无"; return "width: " + w + NL + "height: " + h + NL + "viewBox: " + vb; },
  svg_colors: (t) => { const s = String(t); const colors = Array.from(new Set([...s.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]))); return colors.length ? colors.join(NL) : "未找到十六进制颜色"; },
};

export function apply(ctx, config) {
  void config;
  ctx.tools.register({
    name: "image_info",
    description: "image info",
    parameters: {
      text: { "type": "string", required: true, "description": "base64 / data URI / SVG" },
    },
    output: TEXT_OUTPUT,
    async execute(args) {
      const t = args && args.text != null ? String(args.text) : "";
      try {
        const fn = OPS["image_info"];
        if (!fn) throw new Error("未知操作");
        return { text: ["图片工具：image info", "=".repeat(52), String(fn(t)), "", "更多工具：" + SITE].join(NL) };
      } catch (e) {
        return { text: "处理失败: " + String((e && e.message) || e) };
      }
    },
  });
}
