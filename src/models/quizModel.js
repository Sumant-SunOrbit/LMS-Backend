// This file defines the Mongoose schemas for individual questions and the overall quiz.

const mongoose = require('mongoose');

// This defines the structure for a single multiple-choice question
const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: [true, 'Question text cannot be empty'],
  },
  options: {
    type: [String], // An array of strings for the answer options
    required: true,
    validate: [
      (val) => val.length > 1, // Ensures there are at least two options
      'A question must have at least two options.',
    ],
  },
  correctAnswer: {
    type: String,
    required: [true, 'A correct answer must be specified'],
  },
});

// This defines the main structure for an entire quiz
const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Quiz must have a title'],
      trim: true, // Removes whitespace from the beginning and end
    },
    topic: {
      type: String,
      required: [true, 'Quiz must have a topic or source text'],
    },
    sourceType: {
      type: String,
      enum: ['text', 'pdf', 'combined'], // The source can be text, pdf, or both
      required: true,
    },
    sourceFilename: {
      type: String, // Optional: stores the name of the uploaded PDF
    },
    sourceFileId: {
      type: mongoose.Schema.Types.ObjectId, // Optional: stores the ID of the file in GridFS
    },
    questions: [questionSchema], // An array of questions using the schema above
  },
  {
    // Automatically adds `createdAt` and `updatedAt` fields
    timestamps: true,
  }
);

// Create and export the Quiz model based on the quizSchema
const Quiz = mongoose.model('Quiz', quizSchema);

module.exports = Quiz;

