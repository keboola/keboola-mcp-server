const path = require('path');

module.exports = {
  entry: './src/index.js',
  target: 'webworker',
  output: {
    filename: 'worker.js',
    path: path.join(__dirname, 'dist'),
  },
  mode: process.env.NODE_ENV || 'production',
  optimization: {
    usedExports: true,
  },
  performance: {
    hints: false,
  },
  resolve: {
    fallback: {
      "crypto": false,
      "stream": false,
      "util": false,
      "buffer": false,
    },
  },
}; 