require('dotenv').config();

module.exports = {
    mongoURI: process.env.MONGO_URI,
    openAIKey: process.env.OPENAI_API_KEY
};
