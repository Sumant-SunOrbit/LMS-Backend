const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true,
  },
  score: {
    type: Number,
    required: true,
  },
  totalQuestions: {
    type: Number,
    required: true,
  },
  // This array stores a detailed breakdown of the user's submission
  submittedAnswers: [
    {
      questionId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      questionText: String,
      submittedAnswer: String,
      correctAnswer: String,
      isCorrect: Boolean,
    },
  ],
}, {
  timestamps: true, // Automatically adds createdAt and updatedAt fields
});

module.exports = mongoose.model('Result', resultSchema);
