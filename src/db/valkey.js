import Valkey from "ioredis";
import RedisStore from "connect-redis";

const valkey = new Valkey(process.env.SERVICE_URI);
const valkeyStore = new RedisStore({
  client: valkey,
  prefix: "OTX:",
});

export default valkeyStore;