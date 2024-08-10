import Valkey from "ioredis";
import RedisStore from "connect-redis";

const valkey = new Valkey(process.env.SERVICE_URI);
const redisStore = new RedisStore({
  client: valkey,
  prefix: "OTX:",
});

export default redisStore;