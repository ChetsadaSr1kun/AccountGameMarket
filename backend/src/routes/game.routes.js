"use strict";

const express = require("express");
const gameController = require("../controllers/game.controller");

const router = express.Router();

router.get("/", gameController.listGames);
router.get("/:id/attributes", gameController.getGameAttributes);
router.get("/:id", gameController.getGame);

module.exports = router;
