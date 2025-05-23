const fs = require('fs');
const pdf = require('pdf-parse');
const OpenAI = require('openai');
const Resume = require('../models/resume'); // Path to the Resume model
const config = require('../config'); // Path to the config file

const openai = new OpenAI({
  apiKey: config.openaiApiKey, // Accessing the API key from the imported config
});

async function analyzeResumeContent({ resumeData, name, email }) {
  let resumeText;

  try {
    if (!resumeData) {
      throw new Error('resumeData is required.');
    }
    if (!name || !email) {
      throw new Error('Name and email are required.');
    }

    if (resumeData.filePath) {
      if (!fs.existsSync(resumeData.filePath)) {
        // This specific error is caught and re-thrown below for clarity
        const err = new Error(`File not found: ${resumeData.filePath}`);
        err.code = 'ENOENT'; // Keep or set a code for specific handling if needed
        throw err;
      }
      let dataBuffer;
      try {
        dataBuffer = fs.readFileSync(resumeData.filePath);
      } catch (readError) {
        console.error('Error reading file:', readError.message);
        throw new Error(`Error reading file: ${resumeData.filePath}.`);
      }
      
      try {
        const pdfData = await pdf(dataBuffer);
        resumeText = pdfData.text;
      } catch (parsePdfError) {
        console.error('Error parsing PDF:', parsePdfError.message);
        throw new Error('Error parsing PDF file. Please ensure it is a valid PDF.');
      }
    } else if (resumeData.text) {
      resumeText = resumeData.text;
    } else {
      throw new Error('Either filePath or text must be provided in resumeData.');
    }

    if (!resumeText || resumeText.trim() === '') {
        throw new Error('Extracted resume text is empty.');
    }

    const prompt = `Analyze the following resume text and return a JSON object containing:
- skills (array of strings)
- summary (string, a concise overview of the candidate's profile)
- experienceHighlights (array of strings, key achievements and responsibilities from work experience)
- education (array of strings, educational qualifications, institutions, and dates)
- overallImpression (string, a brief overall assessment of the resume)

The JSON output should be structured as follows:
{
  "skills": ["skill1", "skill2", ...],
  "summary": "...",
  "experienceHighlights": ["highlight1", "highlight2", ...],
  "education": ["education_detail1", "education_detail2", ...],
  "overallImpression": "..."
}

Resume Text:
---
${resumeText}
---
`;

    let aiResponse;
    try {
      aiResponse = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      });
    } catch (openAiError) {
      console.error('OpenAI API Call Error:', openAiError.message);
      // Check if it's an OpenAI specific error object
      if (openAiError.response) {
        throw new Error(`Error communicating with AI service (Status: ${openAiError.response.status}). Please try again later.`);
      } else if (openAiError.code) {
         throw new Error(`Error communicating with AI service (Code: ${openAiError.code}). Please try again later.`);
      }
      throw new Error('Error communicating with AI service. Please try again later.');
    }

    if (!aiResponse.choices || aiResponse.choices.length === 0 || !aiResponse.choices[0].message || !aiResponse.choices[0].message.content) {
      console.error('Invalid response structure from OpenAI API:', aiResponse);
      throw new Error('Invalid response structure from AI service.');
    }
    
    const analysisResultString = aiResponse.choices[0].message.content;
    let analysisResult;

    try {
      analysisResult = JSON.parse(analysisResultString);
    } catch (jsonParseError) {
      console.error('Error parsing JSON response from OpenAI:', jsonParseError.message);
      console.error('OpenAI response string for parsing:', analysisResultString);
      throw new Error('Error processing AI response. Could not parse analysis data.');
    }

    const newResume = new Resume({
      name,
      email,
      skills: analysisResult.skills || [],
      summary: analysisResult.summary || '',
      experienceHighlights: analysisResult.experienceHighlights || [],
      education: analysisResult.education || [],
      overallImpression: analysisResult.overallImpression || '',
      originalResumeText: resumeText,
      fullAnalysis: analysisResult,
    });

    try {
      await newResume.save();
    } catch (dbSaveError) {
      console.error('Database save error:', dbSaveError.message);
      if (dbSaveError.name === 'ValidationError') {
        throw new Error(`Error saving analysis results: Validation failed. ${dbSaveError.message}`);
      } else if (dbSaveError.name === 'MongooseServerSelectionError') {
         throw new Error('Error saving analysis results: Database connection error.');
      }
      throw new Error('Error saving analysis results. Please try again later.');
    }

    return analysisResult;

  } catch (error) {
    // Log the error that reached this top-level catch block
    // These errors are ones that were either re-thrown from specific blocks 
    // or occurred outside of the more specific try-catch blocks.
    console.error('Unhandled error in resume analysis service:', error.message);

    // Ensure the error being thrown out to the route has a clean message
    // and is an instance of Error.
    // If it's one of our custom-thrown errors, it should already be fine.
    // If it's an unexpected error, provide a generic message.
    // Check if the error message matches any of the specific, user-friendly messages
    // already thrown by the service. If so, re-throw it as is.
    const knownMessages = [
        'resumeData is required.',
        'Name and email are required.',
        'Either filePath or text must be provided in resumeData.',
        'Extracted resume text is empty.',
        'File not found:', // StartsWith
        'Error reading file:', // StartsWith
        'Error parsing PDF file.', // Exact match
        'Error communicating with AI service', // StartsWith
        'Invalid response structure from AI service.', // Exact match
        'Error processing AI response.', // Exact match
        'Error saving analysis results' // StartsWith
    ];

    if (error.message && knownMessages.some(knownMsg => error.message.startsWith(knownMsg))) {
      throw error;
    }
    
    // For truly unexpected errors not covered above, throw a generic one.
    throw new Error('An unexpected error occurred during resume analysis. Please check logs for details.');
  }
}

module.exports = {
  analyzeResumeContent,
};
