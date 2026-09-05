const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { initializeApp, cert, getApps } = require("firebase-admin/app");

dotenv.config();

function getServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
    }
  }

  return require("./serviceAccountKey.json");
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert(getServiceAccount()),
  });
}

const router = require("./router/router");

const app = express();

app.use(cors());
app.use(express.json());
app.use("/", router);

app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Not found",
  });
});

const PORT = process.env.PORT || 8000;

const server = app.listen(PORT, "0.0.0.0", () => {
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
