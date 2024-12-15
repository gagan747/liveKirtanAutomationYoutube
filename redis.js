import dotenv from "dotenv";
dotenv.config();
import Redis from "ioredis";

async function getRedisClient() {
  const serviceUri = process.env.redisHost;
  const redis = new Redis(serviceUri);

  try {
    // Test connection by setting a key
    await redis.set("current", 1, "NX");
    await redis.set("perProjectQuota", 0, "NX");
    await redis.set("currentServer", "server1", "NX");

    console.log("Connected to Redis client");

    // Example of getting a key
    const value = await redis.get("current");
    console.log(`The value of 'current' is: ${value}`);

    return redis;
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

export default getRedisClient;