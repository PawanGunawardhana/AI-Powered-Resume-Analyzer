// Mock dependencies (hoisted)
jest.mock('fs');
jest.mock('pdf-parse');
jest.mock('../models/resume'); // Path to the Resume model
jest.mock('../config', () => ({
  openaiApiKey: 'test-api-key',
  mongoURI: 'test-mongo-uri', 
}), { virtual: true });

describe('analyzeResumeContent', () => {
  let analyzeResumeContent;
  let mockOpenAIChatCompletionsCreate;
  
  // These will hold the specific instances of mocks for each test
  let currentFsMock;
  let CurrentResumeModelMock;
  let currentPdfParseMock; // Added for pdf-parse

  beforeEach(() => {
    jest.resetModules(); 

    mockOpenAIChatCompletionsCreate = jest.fn();

    jest.doMock('openai', () => {
      const MockOpenAI = jest.fn().mockImplementation(() => {
        return {
          chat: {
            completions: {
              create: mockOpenAIChatCompletionsCreate
            }
          }
        };
      });
      return MockOpenAI; 
    });

    // Re-require and re-configure mocks for 'fs', '../models/resume', and 'pdf-parse'
    currentFsMock = require('fs');
    currentFsMock.existsSync = jest.fn().mockReturnValue(true); 
    currentFsMock.readFileSync = jest.fn();

    CurrentResumeModelMock = require('../models/resume');
    CurrentResumeModelMock.prototype.save = jest.fn().mockResolvedValue({});

    currentPdfParseMock = require('pdf-parse'); // Get the mock for pdf-parse

    analyzeResumeContent = require('../services/resumeAnalysisService').analyzeResumeContent;
    
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Test Case 1: Successful analysis with text input
  test('should successfully analyze resume from text input', async () => {
    const mockAiResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            skills: ['JavaScript', 'Node.js'],
            summary: 'A developer',
            experienceHighlights: ['Developed stuff'],
            education: ['Degree'],
            overallImpression: 'Good'
          })
        }
      }]
    };
    mockOpenAIChatCompletionsCreate.mockResolvedValue(mockAiResponse);

    const input = {
      resumeData: { text: "Some resume text" },
      name: "John Doe",
      email: "john@example.com"
    };
    const result = await analyzeResumeContent(input);

    const OpenAI = require('openai'); 
    expect(OpenAI).toHaveBeenCalledTimes(1); 
    expect(mockOpenAIChatCompletionsCreate).toHaveBeenCalledTimes(1);
    expect(CurrentResumeModelMock.prototype.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual(JSON.parse(mockAiResponse.choices[0].message.content));
  });

  // Test Case 2: Successful analysis with PDF file input
  test('should successfully analyze resume from PDF file input', async () => {
    const pdfText = "PDF resume text";
    currentFsMock.readFileSync.mockReturnValue(Buffer.from('dummy pdf content'));
    currentPdfParseMock.mockResolvedValue({ text: pdfText }); // Use currentPdfParseMock

    const mockAiResponse = { /* ... */ };
     mockAiResponse.choices = [{ message: { content: JSON.stringify({ skills: ['PDF Expert']})}}];
    mockOpenAIChatCompletionsCreate.mockResolvedValue(mockAiResponse);

    const input = {
      resumeData: { filePath: "dummy.pdf" },
      name: "Jane Doe",
      email: "jane@example.com"
    };
    const result = await analyzeResumeContent(input);

    expect(currentFsMock.existsSync).toHaveBeenCalledWith(input.resumeData.filePath);
    expect(currentFsMock.readFileSync).toHaveBeenCalledWith(input.resumeData.filePath);
    expect(currentPdfParseMock).toHaveBeenCalledTimes(1); // Check currentPdfParseMock
    expect(mockOpenAIChatCompletionsCreate).toHaveBeenCalledTimes(1);
    expect(CurrentResumeModelMock.prototype.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual(JSON.parse(mockAiResponse.choices[0].message.content));
  });

  // Test Case 3: OpenAI API error
  test('should throw user-friendly error on OpenAI API error', async () => {
    const openAIError = new Error("OpenAI API is down");
    openAIError.response = { status: 500, data: "Server error" }; 
    mockOpenAIChatCompletionsCreate.mockRejectedValue(openAIError);
    const input = { resumeData: { text: "Some resume text" }, name: "N", email: "E" };
    await expect(analyzeResumeContent(input))
      .rejects
      .toThrow('Error communicating with AI service (Status: 500). Please try again later.');
  });
  
  // Test Case 4: Database save error
  test('should throw user-friendly error on database save error', async () => {
    mockOpenAIChatCompletionsCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ skills: ['Test'] }) } }] });
    const dbError = new Error("DB save failed");
    dbError.name = "MongooseError"; 
    CurrentResumeModelMock.prototype.save.mockRejectedValue(dbError);
    const input = { resumeData: { text: "Some resume text" }, name: "N", email: "E" };
    await expect(analyzeResumeContent(input))
      .rejects
      .toThrow('Error saving analysis results. Please try again later.');
  });

  // Test Case 5: PDF parsing error
  test('should throw user-friendly error on PDF parsing error', async () => {
    currentFsMock.readFileSync.mockReturnValue(Buffer.from('dummy pdf content'));
    currentPdfParseMock.mockRejectedValue(new Error("Failed to parse PDF")); // Use currentPdfParseMock

    const input = { resumeData: { filePath: "bad.pdf" }, name: "N", email: "E" };
    await expect(analyzeResumeContent(input))
      .rejects
      .toThrow('Error parsing PDF file. Please ensure it is a valid PDF.');
  });

  // Test Case 6: OpenAI returns non-JSON string in message.content
  test('should throw error when OpenAI response is not valid JSON', async () => {
    mockOpenAIChatCompletionsCreate.mockResolvedValue({ choices: [{ message: { content: "this is not a json string" } }] });
    const input = { resumeData: { text: "Some resume text" }, name: "N", email: "E" };
    await expect(analyzeResumeContent(input))
      .rejects
      .toThrow('Error processing AI response. Could not parse analysis data.');
  });

  // Test Case 7: filePath does not exist
  test('should throw error if filePath does not exist', async () => {
    currentFsMock.existsSync.mockReturnValue(false); 
    const input = { resumeData: { filePath: "nonexistent.pdf" }, name: "N", email: "E" };
    await expect(analyzeResumeContent(input))
        .rejects
        .toThrow(`File not found: nonexistent.pdf`);
    expect(currentFsMock.readFileSync).not.toHaveBeenCalled(); 
  });

  // Test Case 8: resume text is empty after extraction
  test('should throw error if extracted resume text is empty', async () => {
    currentFsMock.readFileSync.mockReturnValue(Buffer.from('dummy pdf content'));
    currentPdfParseMock.mockResolvedValue({ text: "  " }); // Use currentPdfParseMock

    const input = { resumeData: { filePath: "empty_text.pdf" }, name: "N", email: "E" };
    await expect(analyzeResumeContent(input))
        .rejects
        .toThrow('Extracted resume text is empty.');
  });

  // Test Case 9: Missing resumeData
  test('should throw error if resumeData is not provided', async () => {
    const input = { name: "John Doe", email: "john@example.com" }; 
    await expect(analyzeResumeContent(input)).rejects.toThrow('resumeData is required.');
  });

  // Test Case 10: Missing name or email
  test('should throw error if name or email is not provided', async () => {
    const inputNameMissing = { resumeData: { text: "Some text" }, email: "john@example.com" }; 
    await expect(analyzeResumeContent(inputNameMissing)).rejects.toThrow('Name and email are required.');
    const inputEmailMissing = { resumeData: { text: "Some text" }, name: "John Doe" }; 
    await expect(analyzeResumeContent(inputEmailMissing)).rejects.toThrow('Name and email are required.');
  });

  // Test Case 11: resumeData provides neither filePath nor text
  test('should throw error if resumeData contains neither filePath nor text', async () => {
    const input = { resumeData: {}, name: "John Doe", email: "john@example.com" };
    await expect(analyzeResumeContent(input)).rejects.toThrow('Either filePath or text must be provided in resumeData.');
  });

  // Test Case 12: OpenAI API returns unexpected structure
  test('should throw error if OpenAI API response structure is invalid (no choices)', async () => {
    mockOpenAIChatCompletionsCreate.mockResolvedValue({ choices: [] }); 
    const input = { resumeData: { text: "Some resume text" }, name:"N", email:"E" };
    await expect(analyzeResumeContent(input)).rejects.toThrow('Invalid response structure from AI service.');
  });

  test('should throw error if OpenAI API response structure is invalid (no message)', async () => {
    mockOpenAIChatCompletionsCreate.mockResolvedValue({ choices: [{}] }); 
    const input = { resumeData: { text: "Some resume text" }, name:"N", email:"E" };
    await expect(analyzeResumeContent(input)).rejects.toThrow('Invalid response structure from AI service.');
  });

  test('should throw error if OpenAI API response structure is invalid (no content)', async () => {
    mockOpenAIChatCompletionsCreate.mockResolvedValue({ choices: [{message: {}}] });
    const input = { resumeData: { text: "Some resume text" }, name:"N", email:"E" };
    await expect(analyzeResumeContent(input)).rejects.toThrow('Invalid response structure from AI service.');
  });

  // Test Case 13: File reading error for PDF
  test('should throw user-friendly error on file read error for PDF', async () => {
    currentFsMock.readFileSync.mockImplementation(() => { throw new Error("Permission denied"); });
    const input = { resumeData: { filePath: "unreadable.pdf" }, name:"N", email:"E" };
    await expect(analyzeResumeContent(input)).rejects.toThrow('Error reading file: unreadable.pdf.');
  });

  // Test Case 14: OpenAI API error without response object
  test('should throw generic AI error when OpenAI error has no response object but has a code', async () => {
    const openAIError = new Error("Network error"); openAIError.code = "ECONNREFUSED"; 
    mockOpenAIChatCompletionsCreate.mockRejectedValue(openAIError);
    const input = { resumeData: { text: "Some resume text" }, name:"N", email:"E" };
    await expect(analyzeResumeContent(input)).rejects.toThrow('Error communicating with AI service (Code: ECONNREFUSED). Please try again later.');
  });

  test('should throw generic AI error when OpenAI error has no response or code', async () => {
    const openAIError = new Error("Very generic AI error");
    mockOpenAIChatCompletionsCreate.mockRejectedValue(openAIError);
    const input = { resumeData: { text: "Some resume text" }, name:"N", email:"E" };
    await expect(analyzeResumeContent(input)).rejects.toThrow('Error communicating with AI service. Please try again later.');
  });

  // Test Case 15: Database save error (MongooseServerSelectionError)
  test('should throw specific DB error for MongooseServerSelectionError', async () => {
    mockOpenAIChatCompletionsCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ skills: ['Test'] }) } }] });
    const dbError = new Error("Connection timed out"); dbError.name = "MongooseServerSelectionError";
    CurrentResumeModelMock.prototype.save.mockRejectedValue(dbError);
    const input = { resumeData: { text: "Some resume text" }, name:"N", email:"E" };
    await expect(analyzeResumeContent(input)).rejects.toThrow('Error saving analysis results: Database connection error.');
  });

  // Test Case 16: Database save error (ValidationError)
  test('should throw specific DB error for ValidationError', async () => {
    mockOpenAIChatCompletionsCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ skills: ['Test'] }) } }] });
    const dbError = new Error("Validation failed for field X"); dbError.name = "ValidationError";
    CurrentResumeModelMock.prototype.save.mockRejectedValue(dbError);
    const input = { resumeData: { text: "Some resume text" }, name:"N", email:"E" };
    await expect(analyzeResumeContent(input)).rejects.toThrow('Error saving analysis results: Validation failed. Validation failed for field X');
  });
});
