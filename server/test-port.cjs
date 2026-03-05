const net = require('net');
const host = 'ac-bj4ewrj-shard-00-00.twjatkb.mongodb.net';
const port = 27017;

console.log(`Testing TCP connection to ${host}:${port}...`);
const socket = new net.Socket();
socket.setTimeout(10000);
socket.on('connect', () => { console.log('SUCCESS: Port 27017 is reachable!'); socket.destroy(); });
socket.on('timeout', () => { console.log('TIMEOUT: Port 27017 not reachable (blocked by firewall or IP not whitelisted)'); socket.destroy(); });
socket.on('error', (err) => { console.log('ERROR:', err.message); });
socket.connect(port, host);
