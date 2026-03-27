require("dotenv").config();

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const db = require("./firebase");

const app = express();

app.use(cors());
app.use(express.json());

app.post("/webhook", async (req, res) => {
  try {

    const data = req.body;

    console.log("TranzUPI webhook received:", data);

    // Example expected structure:
    // data.status
    // data.userId
    // data.amount

    if (data.status !== "SUCCESS") {
      return res.sendStatus(200);
    }

    const uid = data.user_token;
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

app.post("/create-order", async (req, res) => {
  try {

    const { amount, uid, mobile } = req.body;

    console.log("Incoming request body:", req.body);

    if (!amount || !uid || !mobile) {
      return res.json({
        status: false,
        message: "Missing required parameters."
      });
    }

    const response = await axios.post(
      "https://tranzupi.com/api/create-order",
      {
        customer_mobile: mobile,
        user_token: uid,
        amount: amount.toString(),
        order_id: Date.now().toString(),
        redirect_url: "https://lastzone.netlify.app/wallet",
        remark1: "Wallet Deposit",
        remark2: "LastZoneUser"
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.TRANZUPI_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.json(response.data);

  } catch (error) {

    console.log("TranzUPI ERROR:", error.response?.data || error.message);

    res.json({
      status: false,
      message: "Create order failed"
    });

  }
});

app.get("/", (req, res) => {
  res.send("TranzUPI Webhook Server Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
