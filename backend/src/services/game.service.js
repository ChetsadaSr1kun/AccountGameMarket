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

function slugify(value) {
  return String(value).trim().toLowerCase().replace(/[^a-z0-9ก-๙]+/g, '-').replace(/^-+|-+$/g, '');
}

async function listAdminGames() {
  return gameRepository.listAdmin();
}

async function createAdminGame(data) {
  const name=String(data.name||'').trim();
  if(name.length<2||name.length>100) throw new AppError('Game name must be 2-100 characters.',400,'INVALID_GAME_NAME');
  const slug=String(data.slug||slugify(name)).trim();
  if(!/^[a-z0-9ก-๙]+(?:-[a-z0-9ก-๙]+)*$/.test(slug)||slug.length>120) throw new AppError('Invalid game slug.',400,'INVALID_GAME_SLUG');
  const status=String(data.status||'ACTIVE').toUpperCase();
  if(!['ACTIVE','INACTIVE'].includes(status)) throw new AppError('Invalid game status.',400,'INVALID_GAME_STATUS');
  try {
    return await gameRepository.createAdmin({name,slug,description:String(data.description||'').trim(),imageUrl:String(data.imageUrl||'').trim(),status});
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new AppError('Game name or slug already exists.',409,'GAME_ALREADY_EXISTS');
    throw error;
  }
}

async function updateAdminGame(id,data) {
  const game=await gameRepository.findAdminById(Number(id));
  if(!game) throw new AppError('Game not found.',404,'GAME_NOT_FOUND');
  const payload={};
  if(data.name!==undefined){const name=String(data.name).trim();if(name.length<2||name.length>100)throw new AppError('Game name must be 2-100 characters.',400,'INVALID_GAME_NAME');payload.name=name;}
  if(data.slug!==undefined){const slug=String(data.slug).trim();if(!/^[a-z0-9ก-๙]+(?:-[a-z0-9ก-๙]+)*$/.test(slug)||slug.length>120)throw new AppError('Invalid game slug.',400,'INVALID_GAME_SLUG');payload.slug=slug;}
  if(data.description!==undefined)payload.description=String(data.description||'').trim();
  if(data.imageUrl!==undefined)payload.imageUrl=String(data.imageUrl||'').trim();
  if(data.status!==undefined){const status=String(data.status).toUpperCase();if(!['ACTIVE','INACTIVE'].includes(status))throw new AppError('Invalid game status.',400,'INVALID_GAME_STATUS');payload.status=status;}
  try {
    return await gameRepository.updateAdmin(Number(id),payload);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') throw new AppError('Game name or slug already exists.',409,'GAME_ALREADY_EXISTS');
    throw error;
  }
}

async function deactivateAdminGame(id) {
  const game=await gameRepository.findAdminById(Number(id));
  if(!game) throw new AppError('Game not found.',404,'GAME_NOT_FOUND');
  return gameRepository.updateAdmin(Number(id),{status:'INACTIVE'});
}

module.exports = { listGames, getGame, getGameAttributes, listAdminGames, createAdminGame, updateAdminGame, deactivateAdminGame };
