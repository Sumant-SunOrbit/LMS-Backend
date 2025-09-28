// This controller handles the primary logic: extracting text, generating a quiz via AI, and saving everything.

const Quiz = require('../models/quizModel');
const Result = require('../models/resultModel');
const pdf = require('pdf-parse');
const { ChatGroq } = require('@langchain/groq');
const { PromptTemplate } = require('@langchain/core/prompts');
const { LLMChain } = require('langchain/chains');
const { getBucket } = require('../config/db.js');
const { Readable } = require('stream');

/**
 * @desc    Generate a quiz from text, a PDF, or a combination of both.
 * @route   POST /api/quizzes/generate
 * @access  Public
 */



const generateQuizController = async (req, res) => {
  const { title, numQuestions = 5, topic } = req.body;
  if (!title) {
    return res.status(400).json({ message: 'A quiz title is required.' });
  }
  if (!req.file && (!topic || topic.trim().length === 0)) {
    return res.status(400).json({ message: 'Please provide either a topic or a PDF file to generate the quiz.' });
  }

  try {
    let contextText = '';
    let sourceType = '';
    let sourceFilename = null;
    let sourceFileId = null;

    if (topic && topic.trim().length > 0) {
      contextText += `Topic provided by user:\n${topic}`;
      sourceType = 'text';
    }

    if (req.file) {
      console.log('Step 1: Storing PDF in GridFS...');
      const bucket = getBucket();
      const readableStream = Readable.from(req.file.buffer);
      const uploadStream = bucket.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });
      
      readableStream.pipe(uploadStream);

      await new Promise((resolve, reject) => {
        uploadStream.on('error', (error) => reject(error));
        uploadStream.on('finish', () => resolve());
      });

      sourceFileId = uploadStream.id;
      sourceFilename = req.file.originalname;
      console.log(`PDF saved successfully with ID: ${sourceFileId}`);

      console.log('Step 2: Extracting text from PDF...');
      const pdfData = await pdf(req.file.buffer);
      if (pdfData.text) {
        const separator = contextText.length > 0 ? `\n\n--- Content from uploaded PDF (${sourceFilename}) ---\n` : '';
        contextText += separator + pdfData.text;
      }
      sourceType = sourceType === 'text' ? 'combined' : 'pdf';
    }

    if (contextText.trim().length < 50) {
      return res.status(400).json({ message: 'Could not find sufficient text from the provided sources to generate a quiz.' });
    }
    
    console.log(`Step 3: Generating quiz with AI from source type: ${sourceType}`);
    const truncatedContext = contextText.substring(0, 24000); 
    
    const llm = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
    });
    const promptTemplate = `
      You are an expert quiz creator. Given the following context, generate exactly {numQuestions} multiple-choice questions.
      The questions should be relevant and based solely on the provided text.
      IMPORTANT: Your response MUST be a valid JSON array of objects. Do not include any text before or after the array. Each object must have this exact structure:
      {{
        "questionText": "The question text",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswer": "The text of the correct option"
      }}

      Context:
      ---
      {context}
      ---
    `;
    const prompt = new PromptTemplate({ template: promptTemplate, inputVariables: ['context', 'numQuestions'] });
    const chain = new LLMChain({ llm, prompt });
    const aiResponse = await chain.call({ context: truncatedContext, numQuestions });

    console.log('Step 4: Parsing AI response...');
    let questions;
    try {
      let cleanedText = aiResponse.text.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.slice(7, -3);
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.slice(3, -3);
      }
      questions = JSON.parse(cleanedText);

      // Ensure the AI response is a non-empty array before proceeding.
      if (!Array.isArray(questions) || questions.length === 0) {
        console.error('Validation Error: AI response is not a valid or non-empty array.', questions);
        throw new Error('AI failed to generate questions in the expected format.');
      }

    } catch (parseError) {
      console.error('Error parsing AI response:', parseError, 'Raw output:', aiResponse.text);
      return res.status(500).json({ message: 'Failed to parse AI response. The format was invalid.' });
    }

    console.log('Step 5: Saving complete quiz to database...');
    const newQuiz = new Quiz({
      title,
      topic: topic || `Content from ${sourceFilename}`,
      questions,
      sourceType,
      sourceFilename,
      sourceFileId,
    });
    const savedQuiz = await newQuiz.save();
    console.log(`Quiz '${savedQuiz.title}' saved successfully!`);

    res.status(201).json({
      message: 'Quiz generated and saved successfully!',
      quizId: savedQuiz._id,
      data: savedQuiz,
    });
  } catch (error) {
    console.error('An error occurred during quiz generation:', error);
    res.status(500).json({ message: 'An error occurred on the server while generating the quiz.' });
  }
};
// ... rest of the controllers ...

/**
 * @desc    Get all quizzes with minimal details for a list view.
 * @route   GET /api/quizzes
 * @access  Public
 */
const getAllQuizzesController = async (req, res) => {
  try {
    const quizzes = await Quiz.find({}, 'title questions').sort({ createdAt: -1 });
    const quizzesForList = quizzes.map(quiz => ({
        _id: quiz._id,
        title: quiz.title,
        questionCount: quiz.questions.length,
    }));
    res.status(200).json(quizzesForList);
  } catch (error) {
    console.error('Error fetching all quizzes:', error);
    res.status(500).json({ message: 'An error occurred on the server.' });
  }
};


/**
 * @desc    Fetch a quiz by its ID and stream its associated PDF.
 * @route   GET /api/quizzes/:id/pdf
 * @access  Public
 */
const getQuizPdfController = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);

    if (!quiz) {
        return res.status(404).json({ message: 'Quiz not found.' });
    }
    if (!quiz.sourceFileId) {
      return res.status(404).json({ message: 'No PDF found for this quiz.' });
    }

    const bucket = getBucket();
    const downloadStream = bucket.openDownloadStream(quiz.sourceFileId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${quiz.sourceFilename}"`);
    res.setHeader('X-Quiz-Title', encodeURIComponent(quiz.title));

    downloadStream.pipe(res);

    downloadStream.on('error', (error) => {
        console.error('Error streaming PDF from GridFS:', error);
        res.status(500).json({ message: 'Failed to retrieve PDF file.' });
    });

  } catch (error) {
    console.error('Error fetching quiz PDF:', error);
    if (error.kind === 'ObjectId') {
        return res.status(404).json({ message: 'Quiz not found.' });
    }
    res.status(500).json({ message: 'An error occurred on the server.' });
  }
};


/**
 * @desc    Fetch a quiz for a user to take, and any previous results.
 * @route   GET /api/quizzes/:id
 * @access  Public
 */
const getQuizForTakingController = async (req, res) => {
  try {
    const quizId = req.params.id;
    const [quiz, results] = await Promise.all([
      Quiz.findById(quizId),
      Result.find({ quiz: quizId }).sort({ createdAt: -1 })
    ]);

    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }

    const questionsForStudent = quiz.questions.map(q => ({
      _id: q._id,
      questionText: q.questionText,
      options: q.options,
    }));

    const quizForStudent = {
      _id: quiz._id,
      title: quiz.title,
      questions: questionsForStudent,
    };

    res.status(200).json({ 
        quiz: quizForStudent, 
        results: results
    });

  } catch (error) {
    console.error('Error fetching quiz for taking:', error);
    if (error.kind === 'ObjectId') {
        return res.status(404).json({ message: 'Quiz not found.' });
    }
    res.status(500).json({ message: 'An error occurred on the server.' });
  }
};


/**
 * @desc    Submit a quiz and get the results.
 * @route   POST /api/quizzes/:id/submit
 * @access  Public
 */
const submitQuizController = async (req, res) => {
  try {
    const quizId = req.params.id;
    const userAnswers = req.body.answers; 

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found.' });
    }

    let score = 0;
    const detailedResults = [];

    quiz.questions.forEach(correctQuestion => {
      const userAnswerObj = userAnswers.find(
        ans => ans.questionId === correctQuestion._id.toString()
      );
      
      const isCorrect = userAnswerObj && userAnswerObj.answer === correctQuestion.correctAnswer;
      
      if (isCorrect) {
        score++;
      }

      detailedResults.push({
        questionId: correctQuestion._id,
        questionText: correctQuestion.questionText,
        submittedAnswer: userAnswerObj ? userAnswerObj.answer : 'No Answer',
        correctAnswer: correctQuestion.correctAnswer,
        isCorrect: isCorrect,
      });
    });

    const newResult = new Result({
      quiz: quizId,
      score,
      totalQuestions: quiz.questions.length,
      submittedAnswers: detailedResults,
    });

    const savedResult = await newResult.save();

    res.status(200).json({
      message: 'Quiz submitted successfully!',
      resultId: savedResult._id,
      score,
      totalQuestions: quiz.questions.length,
      results: detailedResults,
    });

  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).json({ message: 'An error occurred on the server while submitting the quiz.' });
  }
};


module.exports = { 
    generateQuizController,
    getAllQuizzesController,
    getQuizPdfController,
    getQuizForTakingController,
    submitQuizController,
};

