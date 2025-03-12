const fs = require("fs");
const pdfParse = require("pdf-parse");
const OpenAI = require("openai");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const analyzeResume = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const dataBuffer = fs.readFileSync(file.path);
    const pdfData = await pdfParse(dataBuffer);
    const extractedText = pdfData.text;

    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "Analyze the given resume and provide feedback." },
        { role: "user", content: extractedText }
      ]
    });

    res.json({ text: extractedText, analysis: aiResponse.choices[0].message.content });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = { analyzeResume };
