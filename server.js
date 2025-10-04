import express from "express";
import compareRoute from "./routes/compare.js";

const app = express();

app.use(express.json());

// نربط الراوت
app.use("/api/compare", compareRoute);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));