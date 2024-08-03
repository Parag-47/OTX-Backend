import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME;

async function mongoConnect() {
  try {
    await mongoose.connect(`${MONGODB_URI}/${DB_NAME}`);
    console.log("Connection Successful");
    console.log("Host: ", mongo.connection.host);
  } catch (error) {
    console.error("Error While Connecting To Database: ", error);
    process.exit(1);
  }
}

export default mongoConnect;