require("dotenv").config();

const qs = require("qs");
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const db = require("./firebase");
const admin = require("firebase-admin");

const app = express();

console.log("API KEY:", process.env.TRANZUPI_API_KEY);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/webhook", async (req, res) => {
  try {

    const data = req.body;

    console.log("TranzUPI webhook received:", data);

    if (!data.txn_remark) {
      return res.sendStatus(200);
    }

    const uid = data.remark1;
    const amount = parseFloat(data.amount || 0);

    console.log("Updating wallet for UID:", uid);

    const userRef = db.collection("users").doc(uid);

    const doc = await userRef.get();

    if (!doc.exists) {
      console.log("User not found:", uid);
      return res.sendStatus(404);
    }

    const depositedBalance = doc.data().depositedBalance || 0;
const walletBalance = doc.data().walletBalance || 0;

await userRef.update({
  depositedBalance: depositedBalance + amount,
  walletBalance: walletBalance + amount,
});

    // duplicate check
const existingTxn = await db
  .collection("transactions")
  .where("referenceId", "==", data.order_id)
  .get();

if (!existingTxn.empty) {
  console.log("Transaction already exists, skipping duplicate");
  return res.sendStatus(200);
}

    // ✅ transaction history entry
    console.log("Saving transaction entry...");

    await db.collection("transactions").add({
  userId: uid,
  userName: doc.data().displayName || "User",
  userEmail: doc.data().email,
  amount,
  type: "deposit",
  description: `Deposit Approved - UTR: ${data.txn_remark}`,
  referenceId: data.order_id,
  status: "Success",
  source: "TranzUpi",
  createdAt: admin.firestore.FieldValue.serverTimestamp()
});

    console.log("Transaction saved successfully");

    console.log("Wallet updated successfully:", amount);

    res.sendStatus(200);

  } catch (error) {

    console.log("Webhook error:", error);

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

    const settingsDoc = await db
      .collection("app_settings")
      .doc("main")
      .get();

    if (!settingsDoc.exists) {

      return res.json({
        status: false,
        message: "App settings not found"
      });

    }

    const minDeposit = settingsDoc.data().minDeposit || 10;

    if (Number(amount) < minDeposit) {

      return res.json({
        status: false,
        message: `Minimum deposit amount is ₹${minDeposit}`
      });

    }

    const tranzupiApiKey = settingsDoc.data().tranzupiApiKey;

    if (!tranzupiApiKey) {

      return res.json({
        status: false,
        message: "TranzUPI API key missing in settings"
      });

    }

    
    const qs = require("qs");

const response = await axios.post(
  "https://tranzupi.com/api/create-order",
  qs.stringify({
    customer_mobile: mobile,
    user_token: tranzupiApiKey,
    amount: Number(amount).toFixed(2),
    order_id: "LZL" + Date.now(),
    redirect_url: "https://lastzonelegends.com/wallet",
    remark1: uid,
    remark2: "Wallet"
  }),
  {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
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

// 🔧 One-time migration: Sync totalDeposited for existing users
app.get("/sync-total-deposits", async (req, res) => {
  try {
    const usersSnapshot = await db.collection("users").get();

    let updatedCount = 0;

    for (const doc of usersSnapshot.docs) {
      const data = doc.data();

      // Only update if totalDeposited missing or zero
      if (!data.totalDeposited && data.depositedBalance) {
        await db.collection("users").doc(doc.id).update({
          totalDeposited: data.depositedBalance,
        });

        updatedCount++;
      }
    }

    res.send(`✅ Migration complete. Updated ${updatedCount} users.`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Migration failed.");
  }
});

// 🔧 One-time migration: Sync totalDeposited for existing users
app.get("/sync-total-deposits", async (req, res) => {
  try {
    const usersSnapshot = await db.collection("users").get();

    let updatedCount = 0;

    for (const doc of usersSnapshot.docs) {
      const data = doc.data();

      // Only update if totalDeposited missing or zero
      if (!data.totalDeposited && data.depositedBalance) {
        await db.collection("users").doc(doc.id).update({
          totalDeposited: data.depositedBalance,
        });

        updatedCount++;
      }
    }

    res.send(`✅ Migration complete. Updated ${updatedCount} users.`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Migration failed.");
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
