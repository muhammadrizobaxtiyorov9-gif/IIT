import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/railway-analytics');
  console.log("Connected to MongoDB.");
  
  const db = mongoose.connection.db;
  if (!db) {
    console.error("DB connection not established.");
    process.exit(1);
  }

  const collections = await db.listCollections().toArray();
  console.log("Collections:", collections.map(c => c.name));

  const settingsCollection = db.collection('settings');
  const docs = await settingsCollection.find({}).toArray();
  
  console.log(`Found ${docs.length} documents in 'settings'.`);
  
  docs.forEach((doc, idx) => {
    console.log(`\nDocument ${idx}:`);
    console.log("Keys:", Object.keys(doc));
    if (doc.settings) {
      console.log("type of doc.settings:", Array.isArray(doc.settings) ? 'array' : typeof doc.settings);
      console.log("doc.settings keys:", Object.keys(doc.settings));
      if (doc.settings.map_config) {
        console.log("type of doc.settings.map_config:", Array.isArray(doc.settings.map_config) ? 'array' : typeof doc.settings.map_config);
        if (Array.isArray(doc.settings.map_config)) {
          console.log("doc.settings.map_config[0] keys:", Object.keys(doc.settings.map_config[0]));
        } else {
          console.log("doc.settings.map_config keys:", Object.keys(doc.settings.map_config));
        }
      }
    }
    if (doc.map_config) {
      console.log("type of doc.map_config:", Array.isArray(doc.map_config) ? 'array' : typeof doc.map_config);
    }
  });

  process.exit(0);
}

run();
