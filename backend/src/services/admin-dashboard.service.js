const gameRepository=require('../repositories/game.repository');
async function getSummary(){return gameRepository.adminDashboard();}
module.exports={getSummary};
