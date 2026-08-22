"use strict";

const gameService = require("../services/game.service");

async function listGames(req, res, next) {
  try {
    const games = await gameService.listGames();
    return res.status(200).json({ data: games });
  } catch (error) {
    return next(error);
  }
}

async function getGame(req, res, next) {
  try {
    const game = await gameService.getGame(Number(req.params.id));
    return res.status(200).json({ data: game });
  } catch (error) {
    return next(error);
  }
}

async function getGameAttributes(req, res, next) {
  try {
    const attributes = await gameService.getGameAttributes(Number(req.params.id));
    return res.status(200).json({ data: attributes });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listGames, getGame, getGameAttributes };
