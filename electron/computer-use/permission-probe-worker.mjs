import { verifyComputerCapture } from './permission-probe.mjs';

// Same Node runtime and signed capture helper as production Computer Use.
process.on('disconnect', () => process.exit(1));
try {
  await verifyComputerCapture();
  process.send?.({ ok: true }, () => process.exit(0));
} catch (error) {
  process.send?.({ ok: false, error: error.message }, () => process.exit(1));
}
