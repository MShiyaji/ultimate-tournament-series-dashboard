// search-tournament.js
require('dotenv').config();
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");

const BUCKET_NAME = "ultimate-tournament-data";
const CACHE_KEY = "basic-cache.json";
const TOURNAMENT_ID = "647454"; // The ID you want to find

const s3 = new S3Client({
  region: "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function checkCache() {
  try {
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: CACHE_KEY });
    const response = await s3.send(command);
    
    if (!response.Body) {
      console.log("Empty response from S3");
      return;
    }
    
    const text = await response.Body.transformToString();
    const data = JSON.parse(text);
    
    const tournament = data.tournaments.nodes.find(
      t => String(t.id) === String(TOURNAMENT_ID)
    );
    
    if (tournament) {
      console.log("✅ Tournament found in cache!");
      console.log(JSON.stringify(tournament, null, 2));
    } else {
      console.log("❌ Tournament not found in cache");
    }
  } catch (error) {
    console.error("Error accessing cache:", error.message);
  }
}

checkCache();