import { createServer, connect } from 'node:net';

/** Local-only SOCKS4/5 test server. All accepted destinations terminate on the
 * test HTTP server, so the fixture cannot proxy external traffic. */
export function socksFixture(destinationPort) {
  const sockets = new Set();
  const versions = [];
  const server = createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket)); socket.on('error', () => {});
    let buffer = Buffer.alloc(0), stage = 'greeting';
    const receive = chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      if (stage === 'greeting' && buffer.length >= 2 && buffer[0] === 5) {
        const length = 2 + buffer[1]; if (buffer.length < length) return;
        buffer = buffer.subarray(length); socket.write(Buffer.from([5, 0])); stage = 'connect5';
      }
      let length, port, version;
      if (stage === 'connect5') {
        if (buffer.length < 5) return;
        length = buffer[3] === 1 ? 10 : buffer[3] === 4 ? 22 : 7 + buffer[4];
        if (buffer.length < length) return;
        port = buffer.readUInt16BE(length - 2); version = 5;
      } else if (stage === 'greeting' && buffer[0] === 4 && buffer.length >= 9) {
        const userEnd = buffer.indexOf(0, 8); if (userEnd < 0) return;
        length = userEnd + 1; port = buffer.readUInt16BE(2); version = 4;
        if (buffer[4] === 0 && buffer[5] === 0 && buffer[6] === 0 && buffer[7] !== 0) {
          const end = buffer.indexOf(0, length); if (end < 0) return; length = end + 1;
        }
      } else return;
      if (port !== destinationPort || buffer[1] !== 1) { socket.destroy(); return; }
      versions.push(version);
      socket.removeListener('data', receive);
      const upstream = connect(destinationPort, '127.0.0.1', () => {
        socket.write(version === 5 ? Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, 0, 0]) : Buffer.from([0, 90, 0, 0, 127, 0, 0, 1]));
        if (buffer.length > length) upstream.write(buffer.subarray(length));
        socket.pipe(upstream); upstream.pipe(socket);
      });
      sockets.add(upstream); upstream.on('close', () => sockets.delete(upstream));
      upstream.on('error', () => socket.destroy()); socket.on('close', () => upstream.destroy());
    };
    socket.on('data', receive);
  });
  return { server, versions, close() { for (const socket of sockets) socket.destroy(); return new Promise(resolve => server.close(resolve)); } };
}
