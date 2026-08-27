const app = require('./app');
const config = require('./config/env');
app.listen(config.port, () => {
  console.log(`GameMarket backend is running at http://localhost:${config.port}`);
  console.log('Authentication module is loaded.');
});
