const { MongoClient } = require('mongodb');

// Direct connection string (bypasses SRV lookup)
const uri = 'mongodb://bhushandasari_db_user:xQL1NV0sZHs7Iygg@ac-bj4ewrj-shard-00-00.twjatkb.mongodb.net:27017,ac-bj4ewrj-shard-00-01.twjatkb.mongodb.net:27017,ac-bj4ewrj-shard-00-02.twjatkb.mongodb.net:27017/?authSource=admin&replicaSet=atlas-13r7c4-shard-0&tls=true';

async function explore() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Connected to MongoDB!\n');

    const dbs = await client.db().admin().listDatabases();
    console.log('=== DATABASES ===');
    for (const db of dbs.databases) {
      console.log('  ' + db.name + ' (' + (db.sizeOnDisk / 1024).toFixed(1) + ' KB)');
    }

    for (const dbInfo of dbs.databases) {
      if (['admin', 'local', 'config'].includes(dbInfo.name)) continue;
      const db = client.db(dbInfo.name);
      const collections = await db.listCollections().toArray();
      if (collections.length === 0) continue;

      console.log('\n=== ' + dbInfo.name + ' ===');
      for (const col of collections) {
        const count = await db.collection(col.name).countDocuments();
        console.log('  Collection: ' + col.name + ' (' + count + ' docs)');
        if (count > 0) {
          const sample = await db.collection(col.name).findOne();
          console.log('  Keys:', Object.keys(sample).join(', '));
          console.log('  Sample:', JSON.stringify(sample, null, 2).substring(0, 800));
        }
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await client.close();
  }
}

explore();
