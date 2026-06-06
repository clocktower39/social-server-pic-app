const sharp = require("sharp");

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 85;
const WEBP_QUALITY = 80;

const resizeImage = async (buffer, originalMime, options = {}) => {
  const maxDim = options.maxDimension || MAX_DIMENSION;
  const quality = options.jpegQuality || JPEG_QUALITY;
  const webpQuality = options.webpQuality || WEBP_QUALITY;

  const image = sharp(buffer, { failOn: "none" });
  const metadata = await image.metadata().catch(() => null);
  if (!metadata || !metadata.format) {
    return { buffer, mime: originalMime || "image/jpeg" };
  }

  const needsResize =
    (metadata.width || 0) > maxDim || (metadata.height || 0) > maxDim;

  const isPng = metadata.format === "png";
  const outputFormat = isPng ? "png" : "jpeg";

  const pipeline = needsResize
    ? image.resize({
        width: maxDim,
        height: maxDim,
        fit: "inside",
        withoutEnlargement: true,
      })
    : image;

  let out;
  if (outputFormat === "png") {
    out = await pipeline.png({ quality, compressionLevel: 9 }).toBuffer();
  } else if (originalMime === "image/webp") {
    out = await pipeline.webp({ quality: webpQuality }).toBuffer();
  } else {
    out = await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
  }

  return {
    buffer: out,
    mime: outputFormat === "png" ? "image/png" : "image/jpeg",
    resized: needsResize,
    originalWidth: metadata.width,
    originalHeight: metadata.height,
  };
};

module.exports = {
  resizeImage,
  MAX_DIMENSION,
};
