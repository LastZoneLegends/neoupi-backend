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
