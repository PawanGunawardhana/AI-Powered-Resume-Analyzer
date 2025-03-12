require('dotenv').config();


const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const resumeRoutes = require("./routes/upload");

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use("/api/resume", resumeRoutes);
console.log("OpenAI API Key:", process.env.OPENAI_API_KEY ? "Loaded" : "Missing");

app.listen(5000, () => console.log("Server running on port 5000"));
