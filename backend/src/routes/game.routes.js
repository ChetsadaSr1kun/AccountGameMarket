"use strict";

const express = require("express");
const gameController = require("../controllers/game.controller");
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { requireCsrf } = require('../middleware/csrf.middleware');
const {
  uploadGameImage
} = require(
  '../middleware/game-image-upload.middleware'
);
const router = express.Router();

router.get("/", gameController.listGames);
router.get('/admin', authenticate, authorize('ADMIN'), gameController.listAdminGames);
router.post('/admin', authenticate, authorize('ADMIN'), requireCsrf, gameController.createAdminGame);
router.patch('/admin/:id', authenticate, authorize('ADMIN'), requireCsrf, gameController.updateAdminGame);
router.post(
  '/admin/:id/image',
  authenticate,
  authorize('ADMIN'),
  requireCsrf,
  uploadGameImage,
  gameController.updateAdminGameImage
);
router.get("/:id", gameController.getGame);

module.exports = router;
