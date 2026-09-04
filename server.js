const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { initializeApp, cert, getApps } = require("firebase-admin/app");

dotenv.config();

if (getApps().length === 0) {
  const serviceAccount = require("./serviceAccountKey.json");

  initializeApp({
    credential: cert(serviceAccount),
  });
}

const router = require("./router/router");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/", router);

const PORT = process.env.PORT || 8000;

const server = app.listen(PORT, () => {
  console.log(`Feedback backend listening on port ${PORT}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the other process and try again.`);
  } else {
    console.error("Failed to start server:", error);
  }

  process.exit(1);
});
