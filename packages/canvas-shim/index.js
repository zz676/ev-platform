'use strict';

// Compatibility shim for the `canvas` package, backed by `@napi-rs/canvas`.
// This avoids libcairo / system deps, and works on Vercel/serverless.

const napi = require('@napi-rs/canvas');

function registerFont(fontPath, options) {
  const family = options && options.family ? String(options.family) : undefined;
  if (!family) {
    throw new Error('registerFont(path, { family }) requires a `family`');
  }
  // @napi-rs/canvas uses a global font registry.
  // Weight/style are not modeled the same way as node-canvas; we register under the family name.
  napi.GlobalFonts.registerFromPath(String(fontPath), family);
}

module.exports = {
  // API expected by chartjs-node-canvas
  createCanvas: napi.createCanvas,
  Image: napi.Image,
  registerFont,

  // Extra exports that some consumers might use
  loadImage: napi.loadImage,
  GlobalFonts: napi.GlobalFonts,
};
