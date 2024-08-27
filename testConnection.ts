import { MongoClient } from 'mongodb';

const uri = 'mongodb+srv://jvladko:jvladko@cluster0.ygv1t.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const client = new MongoClient(uri);
console.log("Connecting to MongoDB Atlas... with URI:", uri);
async function run() {
    try {
        await client.connect();
        console.log("Connected successfully to MongoDB Atlas");
        const db = client.db("tic-tac-toe");

        // Test if you can fetch something from a collection
        const collections = await db.collections();
        console.log("Collections:", collections.map(c => c.collectionName));
    } catch (err) {
        console.error("Error connecting to MongoDB Atlas:", err);
    } finally {
        await client.close();
    }
}

run().catch(console.error);

