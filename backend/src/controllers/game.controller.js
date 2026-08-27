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

async function listAdminGames(req, res, next) {
  try { return res.status(200).json({ data: { games: await gameService.listAdminGames() } }); } catch (error) { return next(error); }
}
async function createAdminGame(req, res, next) {
  try { return res.status(201).json({ data: { game: await gameService.createAdminGame(req.body || {}) } }); } catch (error) { return next(error); }
}
async function updateAdminGame(req, res, next) {
  try { return res.status(200).json({ data: { game: await gameService.updateAdminGame(Number(req.params.id), req.body || {}) } }); } catch (error) { return next(error); }
}
async function deactivateAdminGame(req, res, next) {
  try { return res.status(200).json({ data: { game: await gameService.deactivateAdminGame(Number(req.params.id)) } }); } catch (error) { return next(error); }
}

module.exports = { listGames, getGame, getGameAttributes, listAdminGames, createAdminGame, updateAdminGame, deactivateAdminGame };
