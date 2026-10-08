"use strict";

const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const AppError = require("../utils/app-error");

const gameImageDirectory = path.resolve(
  __dirname,
  "../../..",
  "uploads",
  "games"
);

const gameImageUrlPrefix =
  "/uploads/games/";

const managedGameImagePattern =
  /^\/uploads\/games\/game-[a-f0-9-]{36}\.(jpg|png|webp)$/;

function detectGameImageExtension(
  buffer
) {
  // JPEG
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpg";
  }

  // PNG
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(
        Buffer.from([
          0x89,
          0x50,
          0x4e,
          0x47,
          0x0d,
          0x0a,
          0x1a,
          0x0a,
        ])
      )
  ) {
    return "png";
  }

  // WebP
  if (
    buffer.length >= 12 &&
    buffer
      .subarray(0, 4)
      .toString("ascii") ===
      "RIFF" &&
    buffer
      .subarray(8, 12)
      .toString("ascii") ===
      "WEBP"
  ) {
    return "webp";
  }

  return null;
}

function managedGameImagePath(
  imageUrl
) {
  if (
    typeof imageUrl !== "string" ||
    !managedGameImagePattern.test(
      imageUrl
    )
  ) {
    return null;
  }

  return path.join(
    gameImageDirectory,
    path.basename(imageUrl)
  );
}

async function removeFileIfPresent(
  filePath
) {
  if (!filePath) return;

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}

async function saveGameImage(file) {
  if (!file?.buffer) {
    throw new AppError(
      "Game image is required.",
      422,
      "GAME_IMAGE_REQUIRED"
    );
  }

  const extension =
    detectGameImageExtension(
      file.buffer
    );

  if (!extension) {
    throw new AppError(
      "Game image content is not a supported image.",
      422,
      "INVALID_GAME_IMAGE_CONTENT"
    );
  }

  const filename =
    `game-${crypto.randomUUID()}.${extension}`;

  const imageUrl =
    `${gameImageUrlPrefix}${filename}`;

  const filePath = path.join(
    gameImageDirectory,
    filename
  );

  await fs.mkdir(
    gameImageDirectory,
    {
      recursive: true,
    }
  );

  await fs.writeFile(
    filePath,
    file.buffer,
    {
      flag: "wx",
    }
  );

  return {
    imageUrl,
    filePath,
  };
}

async function removeManagedGameImage(
  imageUrl
) {
  const filePath =
    managedGameImagePath(
      imageUrl
    );

  if (!filePath) return;

  await removeFileIfPresent(
    filePath
  );
}

module.exports = {
  saveGameImage,
  removeManagedGameImage,
  removeFileIfPresent,
};