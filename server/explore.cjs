const { MongoClient } = require('mongodb');

const uri = 'mongodb://bhushandasari_db_user:xQL1NV0sZHs7Iygg@ac-bj4ewrj-shard-00-00.twjatkb.mongodb.net:27017,ac-bj4ewrj-shard-00-01.twjatkb.mongodb.net:27017,ac-bj4ewrj-shard-00-02.twjatkb.mongodb.net:27017/?ssl=true&replicaSet=atlas-13r7c4-shard-0&authSource=admin&retryWrites=true&w=majority';

const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
  tls: true,
});

async function explore() {
  try {
    console.log('Connecting...');
    await client.connect();
    console.log('Connected!\n');

    const dbs = await client.db().admin().listDatabases();
    console.log('=== DATABASES ===');
    for (const db of dbs.databases) {
      console.log(`  ${db.name} (${(db.sizeOnDisk / 1024).toFixed(1)} KB)`);
    }

    for (const dbInfo of dbs.databases) {
      if (['admin', 'local', 'config'].includes(dbInfo.name)) continue;
      const db = client.db(dbInfo.name);
      const collections = await db.listCollections().toArray();
      console.log(`\n=== DB: ${dbInfo.name} ===`);
      for (const col of collections) {
        const count = await db.collection(col.name).countDocuments();
        console.log(`  Collection: ${col.name} (${count} docs)`);
        if (count > 0) {
          const sample = await db.collection(col.name).findOne();
          console.log(`  Keys: ${Object.keys(sample).join(', ')}`);
          console.log(`  Sample:\n${JSON.stringify(sample, null, 2).substring(0, 1200)}`);
          console.log('---');
        }
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.close();
  }
}

explore();
