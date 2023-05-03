import { createClient } from 'redis';
async function getRedisClient() {
 const client = createClient({
  password: 'BqEDYWbTu8GaoB873uX28u4KHNF6Th56',
  socket: {
   host: 'redis-15021.c232.us-east-1-2.ec2.cloud.redislabs.com',
   port: 15021
  }
 });
 try {
  await client.connect(); // can also listen for events 'on connect' and 'on error' but used await like syntax
  console.log('connected to redis client');
  await client.set('current', 0, { 'NX': true });
  await client.set('perProjectQuota', 0, { 'NX': true });
  return client;
 } catch (err) {
  console.log(err);
  process.exit(1);
 }
}

export default getRedisClient;
