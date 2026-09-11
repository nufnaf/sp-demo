import { app, net, session } from 'electron';
import { createSystemNetworkBridge } from '../../electron/system-network.mjs';

app.setPath('userData', process.env.SYNTROPIC_TEST_DATA);
app.commandLine.appendSwitch('host-resolver-rules', 'MAP direct.fixture.test 127.0.0.1, MAP secure.fixture.test 127.0.0.1');
void app.whenReady().then(async () => {
const networkSession = session.fromPartition('network-test', { cache: false });
// Trust only the self-signed local test certificate, never a real destination.
networkSession.setCertificateVerifyProc((details, callback) => callback(
  details.hostname === 'secure.fixture.test' ? 0 : -3));
const bridge = await createSystemNetworkBridge(options => net.request({ ...options, session: networkSession }));
globalThis.systemNetworkFixture = { bridge, session: networkSession };
});
