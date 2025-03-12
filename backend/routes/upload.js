const express = require('express');
const router = express.Router();
const axios = require('axios');
const Resume = require('../models/Resume');
const { openAIKey } = require('../config');

router.post('/', async (req, res) => {
    try {
        const { name, email, resumeText } = req.body;

        if (!resumeText) return res.status(400).json({ error: "Resume text is required" });

        // OpenAI API Call
        const response = await axios.post("https://api.openai.com/v1/completions", {
            model: "gpt-4",
            prompt: `Extract skills, summary, and key information from this resume:\n\n${resumeText}`,
            max_tokens: 200
        }, {
            headers: { "Authorization": `Bearer ${openAIKey}` }
        });

        const parsedData = response.data.choices[0].text.trim();

        // Save to MongoDB
        const newResume = new Resume({ name, email, skills: parsedData.split(','), summary: parsedData });
        await newResume.save();

        res.json({ message: "Resume analyzed and saved successfully", parsedData });

    } catch (err) {
        console.error("❌ Error in OpenAI API:", err.response?.data || err.message);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
