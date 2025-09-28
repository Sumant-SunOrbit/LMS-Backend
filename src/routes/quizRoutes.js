// This file defines the API routes for all quiz-related operations.

const express = require('express');
const multer = require('multer');
const {
  generateQuizController,
  getAllQuizzesController,
  getQuizForTakingController,
  submitQuizController,
  getQuizPdfController,
} = require('../controllers/quizController');

const router = express.Router();

// Configure multer for memory storage to handle file uploads.
// This is ideal because we process the file buffer directly in the controller 
// and don't need to save it to the server's local disk.
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // Set a 10MB file size limit for uploads
});

// --- DEFINE API ROUTES ---

/**
 * @route   POST /api/quizzes/generate
 * @desc    Generate a new quiz from text, a PDF, or both.
 * @access  Public
 */
router.post('/generate', upload.single('pdfFile'), generateQuizController);

/**
 * @route   GET /api/quizzes
 * @desc    Get a list of all available quizzes.
 * @access  Public
 */
router.get('/', getAllQuizzesController);

/**
 * @route   GET /api/quizzes/:id
 * @desc    Get a specific quiz for a user to take (omitting answers).
 * @access  Public
 */
router.get('/:id', getQuizForTakingController);

/**
 * @route   GET /api/quizzes/:id/pdf
 * @desc    Get the associated PDF for a specific quiz to display it.
 * @access  Public
 */
router.get('/:id/pdf', getQuizPdfController);

/**
 * @route   POST /api/quizzes/:id/submit
 * @desc    Submit answers for a quiz and get the score and results.
 * @access  Public
 */
router.post('/:id/submit', submitQuizController);

module.exports = router;

