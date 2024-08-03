import http from "node:http";
import app from "./app.js";
import { mongoConnect } from "./mongo.js";

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

async function startServer() {
  await mongoConnect();
  server.listen(PORT, () => console.log(`Server Is Listening On ${PORT}`));
}

startServer();