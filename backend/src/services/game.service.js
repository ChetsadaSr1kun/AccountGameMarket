"use strict";

const gameRepository = require("../repositories/game.repository");
const AppError = require("../utils/app-error");

async function listGames() {
  return gameRepository.listActive();
}

async function getGame(gameId) {
  const game = await gameRepository.findActiveById(gameId);
  if (!game) throw new AppError("Game not found.", 404, "GAME_NOT_FOUND");
  return game;
}

async function getGameAttributes(gameId) {
  const game = await gameRepository.findActiveById(gameId);
  if (!game) throw new AppError("Game not found.", 404, "GAME_NOT_FOUND");
  return gameRepository.listActiveAttributes(gameId);
}

module.exports = { listGames, getGame, getGameAttributes };
