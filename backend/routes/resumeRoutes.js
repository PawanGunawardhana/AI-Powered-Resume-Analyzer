const express = require("express");
const multer = require("multer");
const { analyzeResume } = require("../controllers/resumeController");

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/upload", upload.single("resume"), analyzeResume);

module.exports = router;
