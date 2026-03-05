const dns = require('dns');

// Test basic DNS
dns.resolve('google.com', (err, addresses) => {
  console.log('google.com DNS:', err ? err.message : addresses);
});

// Test SRV record for MongoDB
dns.resolveSrv('_mongodb._tcp.cluster25.twjatkb.mongodb.net', (err, addresses) => {
  console.log('MongoDB SRV:', err ? err.message : addresses);
});

// Test TXT record
dns.resolveTxt('cluster25.twjatkb.mongodb.net', (err, records) => {
  console.log('MongoDB TXT:', err ? err.message : records);
});
