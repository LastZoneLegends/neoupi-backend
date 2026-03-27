require("dotenv").config();

const express = require("express");
const cors = require("cors");
const db = require("./firebase");

const app = express();

app.use(cors());
app.use(express.json());

app.post("/neoupi-webhook", async (req, res) => {
  try {

    const data = req.body;

    console.log("Webhook received:", data);

    if (data.status !== "SUCCESS") {
      return res.sendStatus(200);
    }

    const uid = data.userId;
    const amount = Number(data.amount);

    const userRef = db.collection("users").doc(uid);

    const doc = await userRef.get();

    if (!doc.exists) {
      console.log("User not found");
      return res.sendStatus(404);
    }

    const currentBalance = doc.data().wallet || 0;

    await userRef.update({
      wallet: currentBalance + amount,
    });

    console.log("Wallet updated successfully");

    res.sendStatus(200);

  } catch (error) {

    console.log(error);

    res.sendStatus(500);

  }
});

app.get("/", (req, res) => {
  res.send("NeoUPI Webhook Server Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
