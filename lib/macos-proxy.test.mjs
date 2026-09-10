import test from 'node:test';
import assert from 'node:assert/strict';
import { createJiti } from 'jiti';
const { parseMacOSProxySettings, macOSProxyForUrl } = await createJiti(import.meta.url).import('./macos-proxy.ts');

const fixture = `<dictionary> {
  HTTPEnable : 1
  HTTPProxy : 127.0.0.1
  HTTPPort : 7890
  HTTPSEnable : 1
  HTTPSProxy : ::1
  HTTPSPort : 7891
  ExcludeSimpleHostnames : 1
  ExceptionsList : <array> {
    0 : *.local
    1 : 10.0.0.0/8
    2 : fc00::/7
    3 : intranet.example.com
  }
  __SCOPED__ : <dictionary> {
    en0 : <dictionary> {
      HTTPSProxy : wrong.invalid
      HTTPSPort : 99
    }
  }
}`;
test('effective macOS proxy uses HTTPS proxy over CONNECT and respects direct destinations', () => {
  const settings = parseMacOSProxySettings(fixture);
  assert.equal(macOSProxyForUrl(settings, new URL('https://syntropic-recruiting.vercel.app/')), 'http://[::1]:7891/');
  assert.equal(macOSProxyForUrl(settings, new URL('http://example.com/')), 'http://127.0.0.1:7890/');
  for (const host of ['localhost', '127.0.0.2', '[::1]', 'printer', 'printer.local', '10.23.4.5', '[fd00::123]', 'intranet.example.com']) {
    assert.equal(macOSProxyForUrl(settings, new URL(`http://${host}:30141/`)), undefined, host);
  }
  assert.equal(macOSProxyForUrl(settings, new URL('https://not-intranet.example.com/')), settings.https);
});
test('disabled, malformed and automatic proxy settings are not misread as active manual proxies', () => {
  assert.equal(parseMacOSProxySettings('not a proxy configuration'), undefined);
  assert.equal(parseMacOSProxySettings(fixture.replace('HTTPEnable : 1', 'HTTPEnable : 0').replace('HTTPSEnable : 1', 'HTTPSEnable : 0')), undefined);
  assert.equal(parseMacOSProxySettings(fixture.replace('HTTPPort : 7890', 'HTTPPort : 99999').replace('HTTPSProxy : ::1', 'HTTPSProxy : user@host')), undefined);
  assert.equal(parseMacOSProxySettings(fixture.replace('  HTTPEnable', '  ProxyAutoConfigEnable : 1\n  HTTPEnable')), undefined);
});
test('a SOCKS-only system configuration is usable for both HTTP and HTTPS', () => {
  const settings = parseMacOSProxySettings('<dictionary> {\n SOCKSEnable : 1\n SOCKSProxy : 127.0.0.1\n SOCKSPort : 1080\n}');
  assert.equal(macOSProxyForUrl(settings, new URL('https://example.com')), 'socks5://127.0.0.1:1080');
});
