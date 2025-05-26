const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { analyzeResumeContent } = require('../services/resumeAnalysisService');

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Ensure this directory exists or is created
  },
  filename: function (req, file, cb) {
    // cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    // Using a more robust unique name to avoid collisions and keep original extension
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Only accept PDF files by checking mimetype
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed! (application/pdf)'), false);
    }
  },
  limits: {
    fileSize: 1024 * 1024 * 5 // 5 MB file size limit
  }
});

// Middleware to handle multer errors specifically for the upload.single('resumeFile')
const handleUploadErrors = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `File too large. Maximum size is ${5}MB.` });
    }
    // Could add more specific multer error checks here if needed
    return res.status(400).json({ error: err.message });
  } else if (err) {
    // Handle other errors that might have occurred during file processing
    return res.status(400).json({ error: err.message });
  }
  // If no error, or error not related to multer, proceed
  next();
};

router.post('/', (req, res, next) => {
  // Apply multer middleware first
  upload.single('resumeFile')(req, res, (err) => {
    // Then apply our custom error handler for multer errors
    handleUploadErrors(err, req, res, async () => {
      // If no multer errors, proceed with the route logic
      try {
        const { name, email, resumeText } = req.body;

        if (!name || !email) {
            return res.status(400).json({ error: "Name and email are required." });
        }

        let analysisResult;
        let resumeDataInput = {};

        if (req.file && req.file.path) {
            resumeDataInput.filePath = req.file.path;
        } else if (resumeText) {
            resumeDataInput.text = resumeText;
        } else {
            return res.status(400).json({ error: "Either a resume file (resumeFile) or resume text (resumeText) is required." });
        }

        analysisResult = await analyzeResumeContent({
            resumeData: resumeDataInput,
            name,
            email
        });

        res.json({ message: "Resume analyzed successfully", data: analysisResult });

    } catch (error) {
        console.error("❌ Error in upload route:", error.message);
        // Send a more user-friendly error message
        let statusCode = 500;
        if (error instanceof multer.MulterError) { // This specific check might be redundant if handleUploadErrors catches all
            statusCode = 400;
        } else if (error.message.includes("Only PDF files are allowed")) { // Kept for the fileFilter custom error
            statusCode = 400;
        } else if (error.message.includes("File not found") || error.message.includes("Name and email are required") || error.message.includes("resume file (resumeFile) or resume text (resumeText) is required")) {
            statusCode = 400;
        } else if (error.message.includes("OpenAI API Error")) {
            statusCode = 502; // Bad Gateway, as our server depends on OpenAI
        } else if (error.message.includes("Database")) {
            statusCode = 503; // Service Unavailable (database issue)
        }
        
        res.status(statusCode).json({ error: error.message || "Internal Server Error" });
    }
});
  
module.exports = router;
