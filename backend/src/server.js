const app = require('./app');
const config = require('./config/env');
const { startEscrowReleaseJob } = require('./jobs/escrow-release.job');

startEscrowReleaseJob();

app.listen(config.port, () => {
  console.log(`GameMarket backend is running at http://localhost:${config.port}`);
  console.log('Authentication module is loaded. Run npm.cmd run db:migrate after configuring MySQL.');
});
