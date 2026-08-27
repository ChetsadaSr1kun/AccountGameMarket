const orderService = require('../services/order.service');

let timer = null;
let running = false;

async function runEscrowRelease() {
  if (running) return 0;
  running = true;
  try {
    const released = await orderService.releaseExpiredSellerFunds();
    if (released > 0) console.log(`[Escrow] Released ${released} expired order(s).`);
    return released;
  } catch (error) {
    console.error('[Escrow] Automatic release failed:', error);
    return 0;
  } finally {
    running = false;
  }
}

function startEscrowReleaseJob(intervalMs = 60 * 1000) {
  if (timer) return;
  runEscrowRelease();
  timer = setInterval(runEscrowRelease, intervalMs);
  console.log('[Escrow] Automatic 24-hour release job started (checks every minute).');
}

function stopEscrowReleaseJob() {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}

module.exports = { startEscrowReleaseJob, stopEscrowReleaseJob, runEscrowRelease };
