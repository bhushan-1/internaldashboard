const dns = require('dns');
const { Resolver } = dns.promises;
const resolver = new Resolver();
resolver.setServers(['8.8.8.8']);

async function lookup() {
  try {
    const txt = await resolver.resolveTxt('cluster25.twjatkb.mongodb.net');
    console.log('TXT records:', txt);
  } catch(e) {
    console.log('TXT error:', e.message);
  }
  try {
    const srv = await resolver.resolveSrv('_mongodb._tcp.cluster25.twjatkb.mongodb.net');
    console.log('SRV records:', srv);
  } catch(e) {
    console.log('SRV error:', e.message);
  }
}
lookup();
